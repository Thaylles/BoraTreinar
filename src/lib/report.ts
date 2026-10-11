import { computeDashboard, formatKg, weightChange, type Period, type SummarySession, type Trend } from "./stats.ts";

/** Um aluno no relatório semanal. Tudo já resolvido em texto/número para guardar em JSON e mandar por e-mail. */
export type ReportStudent = {
  id: string;
  name: string;
  sessions: number;
  prevSessions: number;
  plans: { name: string; count: number }[];
  free: number;
  volume: number;
  prevVolume: number;
  exercises: { name: string; current: number; previous: number | null; delta: number; trend: Trend }[];
  prs: { name: string; load: number }[];
  streakWeeks: number;
  /** `visible: false` quando o aluno não permite que o Personal veja o peso. */
  weight: { visible: false } | { visible: true; change: { first: number; last: number; delta: number } | null };
  /** Sugestões por regras simples (sempre presentes; também é o formato dos relatórios antigos). */
  suggestions: string[];
  /** Sugestões de cada IA configurada, para comparar lado a lado com as regras. */
  aiSuggestions?: { source: AiSource; items: string[] }[];
};

export type AiSource = "gemini" | "claude";
export type SuggestionSource = "regras" | AiSource;

export const SOURCE_LABEL: Record<SuggestionSource, string> = {
  regras: "Regras (sem IA)",
  gemini: "Gemini (IA do Google)",
  claude: "Claude (IA da Anthropic)",
};

export type ReportContent = {
  week_start: string;
  week_end: string;
  students: ReportStudent[];
  ai: boolean;
  /** Como cada IA se saiu ao gerar este relatório (ausente nos relatórios antigos). */
  aiStatus?: { source: AiSource; ok: boolean; error?: string }[];
};

/** Blocos de sugestões de um aluno, na ordem regras → IAs. */
export function suggestionSets(s: ReportStudent): { source: SuggestionSource; items: string[] }[] {
  const sets: { source: SuggestionSource; items: string[] }[] = [];
  if (s.suggestions.length) sets.push({ source: "regras", items: s.suggestions });
  for (const a of s.aiSuggestions ?? []) if (a.items.length) sets.push(a);
  return sets;
}

/** Monta o bloco de um aluno a partir do resumo de treinos (sem as sugestões). */
export function buildStudentReport(input: {
  id: string;
  name: string;
  sessions: SummarySession[];
  names: Record<string, string>;
  period: Period;
  today: string;
  /** Pesagens só quando o aluno permite; null quando não permite. */
  weights: { measured_on: string; weight_kg: number }[] | null;
}): ReportStudent {
  const { period } = input;
  const d = computeDashboard(input.sessions, period, input.today);
  const week = input.sessions.filter((s) => s.date >= period.from && s.date <= period.to);
  const planCount = new Map<string, number>();
  for (const s of week) if (s.kind === "ficha") planCount.set(s.plan ?? "Ficha", (planCount.get(s.plan ?? "Ficha") ?? 0) + 1);
  const nameOf = (id: string) => input.names[id] ?? "Exercício";
  const change = input.weights ? weightChange(input.weights, period) : null;
  return {
    id: input.id,
    name: input.name,
    sessions: d.totals.sessions,
    prevSessions: d.prevTotals.sessions,
    plans: [...planCount].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    free: week.filter((s) => s.kind === "livre").length,
    volume: d.totals.volume,
    prevVolume: d.prevTotals.volume,
    exercises: d.progress.map((p) => ({ name: nameOf(p.id), current: p.current, previous: p.previous, delta: p.delta, trend: p.trend })),
    prs: d.prs.map((p) => ({ name: nameOf(p.id), load: p.load })),
    streakWeeks: d.streakWeeks,
    weight: input.weights ? { visible: true, change: change && { first: change.first, last: change.last, delta: change.delta } } : { visible: false },
    suggestions: [],
  };
}

const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;

/** Sugestões por regras simples (usadas quando não há chave de IA ou a IA falha). No máximo 4. */
export function ruleSuggestions(s: ReportStudent): string[] {
  const out: string[] = [];
  if (s.sessions === 0) {
    out.push("Não treinou nesta semana: mande uma mensagem para entender o motivo e combinar os dias da próxima semana.");
    if (s.prevSessions === 0) out.push("Já são duas semanas sem treino: vale rever a rotina e propor treinos mais curtos para retomar o hábito.");
    return out;
  }
  if (s.sessions < 3) out.push(`Fez ${s.sessions} ${s.sessions === 1 ? "treino" : "treinos"}: incentive a frequência, com a meta de pelo menos 3 por semana.`);
  const same = s.exercises.filter((e) => e.trend === "same" && e.current > 0).map((e) => e.name);
  if (same.length)
    out.push(`Carga estagnada em ${list(same.slice(0, 3))}: experimente aumentar 2–5% ou subir as repetições antes de subir a carga.`);
  const down = s.exercises.filter((e) => e.trend === "down").map((e) => e.name);
  if (down.length)
    out.push(`Carga caiu em ${list(down.slice(0, 3))}: reveja volume, descanso e técnica; pode ser sinal de cansaço acumulado.`);
  const up = s.exercises.filter((e) => e.trend === "up").map((e) => e.name);
  if (up.length && out.length < 4) out.push(`Boa evolução em ${list(up.slice(0, 3))}: mantenha a progressão gradual.`);
  if (s.prs.length && out.length < 4) out.push(`Bateu ${s.prs.length === 1 ? "um recorde" : `${s.prs.length} recordes`}: vale parabenizar para manter a motivação!`);
  if (s.weight.visible && s.weight.change && Math.abs(s.weight.change.delta) >= 1 && out.length < 4)
    out.push(`Peso variou ${s.weight.change.delta > 0 ? "+" : ""}${s.weight.change.delta.toLocaleString("pt-BR")} kg na semana: confira se está de acordo com o objetivo.`);
  if (s.streakWeeks >= 4 && out.length < 4) out.push(`${s.streakWeeks} semanas seguidas treinando: ótima constância, reconheça o esforço.`);
  return out.slice(0, 4);
}

const TREND_TEXT: Record<Trend, string> = { up: "aumentou", same: "manteve", down: "diminuiu", new: "primeira vez" };
const TREND_COLOR: Record<Trend, string> = { up: "#007a2e", same: "#5b6577", down: "#c2381a", new: "#8a6500" };
const TREND_ARROW: Record<Trend, string> = { up: "▲", same: "●", down: "▼", new: "★" };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const signedKg = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR")} kg`;

/** Uma linha de resumo do aluno ("3 treinos: Treino A (2), livre (1)"). */
export function sessionsLine(s: ReportStudent): string {
  if (!s.sessions) return "Nenhum treino nesta semana";
  const parts = s.plans.map((p) => `${p.name}${p.count > 1 ? ` (${p.count})` : ""}`);
  if (s.free) parts.push(`treino livre${s.free > 1 ? ` (${s.free})` : ""}`);
  return `${s.sessions} ${s.sessions === 1 ? "treino" : "treinos"}: ${parts.join(", ")}`;
}

/** HTML do e-mail (estilos inline, sem imagens externas). */
export function reportHtml(content: ReportContent, opts: { personalName: string; reportUrl: string }): string {
  const students = [...content.students].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "pt-BR"));
  const total = students.reduce((a, s) => a + s.sessions, 0);
  const blocks = students
    .map((s) => {
      const ex = s.exercises
        .map(
          (e) =>
            `<tr><td style="padding:4px 8px 4px 0">${esc(e.name)}</td><td style="padding:4px 8px;text-align:right;white-space:nowrap">${formatKg(e.current)}</td>` +
            `<td style="padding:4px 0;color:${TREND_COLOR[e.trend]};font-weight:700;white-space:nowrap">${TREND_ARROW[e.trend]} ${TREND_TEXT[e.trend]}${
              e.trend === "up" || e.trend === "down" ? ` (${signedKg(e.delta)})` : ""
            }</td></tr>`,
        )
        .join("");
      const notes: string[] = [];
      if (s.prs.length) notes.push(`🏆 Recordes: ${s.prs.map((p) => `${esc(p.name)} ${formatKg(p.load)}`).join(", ")}`);
      if (s.streakWeeks >= 2) notes.push(`🔥 ${s.streakWeeks} semanas seguidas treinando`);
      if (s.weight.visible && s.weight.change) notes.push(`⚖️ Peso: ${formatKg(s.weight.change.first)} → ${formatKg(s.weight.change.last)} (${signedKg(s.weight.change.delta)})`);
      return `<div style="border:1px solid #eadfc6;border-radius:16px;padding:16px;margin:0 0 16px;background:#ffffff">
  <h3 style="margin:0 0 4px;color:#002776;font-size:18px">${esc(s.name)}</h3>
  <p style="margin:0 0 8px;color:#5b6577">${esc(sessionsLine(s))}${s.volume ? ` · volume ${formatKg(s.volume)}` : ""}</p>
  ${ex ? `<table style="border-collapse:collapse;font-size:14px;margin:0 0 8px">${ex}</table>` : ""}
  ${notes.length ? `<p style="margin:0 0 8px;font-size:14px">${notes.join("<br>")}</p>` : ""}
  ${suggestionSets(s)
    .map(
      (set) =>
        `<p style="margin:10px 0 4px;font-weight:700;color:${set.source === "regras" ? "#5b6577" : "#009C3B"}">Sugestões · ${esc(SOURCE_LABEL[set.source])}</p><ul style="margin:0;padding-left:20px;font-size:14px;list-style:disc">${set.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`,
    )
    .join("")}
</div>`;
    })
    .join("\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#10213f;background:#FFF8E7;padding:20px">
<h2 style="color:#009C3B;margin:0 0 4px">Relatório da semana · ${ddmm(content.week_start)} a ${ddmm(content.week_end)}</h2>
<p style="margin:0 0 16px">Fala, ${esc(opts.personalName.split(" ")[0])}! Seus alunos fizeram <strong>${total} ${total === 1 ? "treino" : "treinos"}</strong> nesta semana. Bora ver como foi:</p>
${blocks || "<p>Nenhum aluno ativo no momento.</p>"}
<p style="font-size:12px;color:#5b6577;margin:0 0 16px">Comparação de carga: maior carga da semana × última vez que o aluno fez o exercício. ${
    content.ai
      ? "Fase de testes: as sugestões marcadas como IA foram geradas por inteligência artificial (revise antes de aplicar) e aparecem ao lado das regras simples para comparação."
      : "Sugestões geradas por regras simples."
  }</p>
<p style="margin:16px 0 0"><a href="${esc(opts.reportUrl)}" style="background:#009C3B;color:#ffffff;padding:10px 16px;border-radius:12px;text-decoration:none;font-weight:700">Ver no BoraTreinar</a></p>
</div>`;
}
