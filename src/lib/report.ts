import { computeDashboard, formatKg, weightChange, type Period, type SummarySession, type Trend } from "./stats.ts";
import { cardioSetLine, formatAmount, goalLabel, goalProgress, type CardioWeek } from "./cardio.ts";

/** Exercício que o aluno deixou de fazer na semana. */
export type MissedExercise = {
  name: string;
  /** "pulado": estava na ficha e não foi registrado; "incompleto": séries marcadas como não feitas. */
  kind: "pulado" | "incompleto";
  /** Quantas vezes (pulado) ou quantas séries (incompleto). */
  count: number;
  /** Séries no total (incompleto). */
  total?: number;
  plans: string[];
};

/** Detalhes extras da semana (ausentes nos relatórios antigos). */
export type ReportWeekDetail = {
  /** Dias diferentes com treino e a meta semanal do aluno (dias), se houver. */
  days: number;
  weeklyGoal: number | null;
  /** Tempo total de treino na semana (min). */
  minutes: number;
  missed: MissedExercise[];
  cardio: {
    minutes: number;
    km: number;
    intenseMinutes: number;
    days: number;
    items: { name: string; date: string; line: string }[];
    goal: { label: string; value: number; target: number; unit: string; pct: number; done: boolean; byPersonal: boolean } | null;
  };
  effort: { avg: number | null; rated: number; pain: number; feedback: string[] };
  /** Último treino (qualquer data), para quem não treinou na semana. */
  lastWorkout: string | null;
  achievements: { emoji: string; title: string }[];
};

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
  aiSuggestions?: { source: AiSource; items: string[]; motivation?: string }[];
  /** Semana em detalhe: o que deixou de fazer, cardio, esforço, conquistas. */
  detail?: ReportWeekDetail;
  /** Mensagem de motivação (regras) que o Personal pode mandar para o aluno. */
  motivation?: string;
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
  /** Exercícios de cardio (ficam fora da comparação de carga). */
  cardioIds?: Set<string>;
  detail?: ReportWeekDetail;
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
    exercises: d.progress
      .filter((p) => !input.cardioIds?.has(p.id))
      .map((p) => ({ name: nameOf(p.id), current: p.current, previous: p.previous, delta: p.delta, trend: p.trend })),
    prs: d.prs.map((p) => ({ name: nameOf(p.id), load: p.load })),
    streakWeeks: d.streakWeeks,
    weight: input.weights ? { visible: true, change: change && { first: change.first, last: change.last, delta: change.delta } } : { visible: false },
    suggestions: [],
    ...(input.detail && { detail: input.detail }),
  };
}

export type WeekSessionRow = {
  id: string;
  date: string;
  plan_id: string | null;
  plan_name: string | null;
  duration_seconds: number;
  effort: number | null;
  pain: boolean;
  feedback: string | null;
};
export type WeekSetRow = {
  session_id: string;
  equipment_id: string;
  done: boolean;
  reps: number;
  duration_min: number | null;
  distance_km: number | null;
  speed_kmh: number | null;
  incline_pct: number | null;
  level: number | null;
};

/** Junta sessões, séries e fichas da semana nos detalhes do relatório (função pura, testável). */
export function weekDetail(input: {
  sessions: WeekSessionRow[];
  sets: WeekSetRow[];
  /** Exercícios de cada ficha (plan_id → equipment_ids). */
  planItems: Record<string, string[]>;
  equipment: Record<string, { name: string; cardio: boolean }>;
  cardioWeek: CardioWeek | null;
  weeklyGoal: number | null;
  lastWorkout: string | null;
  achievements: { emoji: string; title: string }[];
}): ReportWeekDetail {
  const eq = (id: string) => input.equipment[id] ?? { name: "Exercício", cardio: false };
  const missed = new Map<string, MissedExercise>();
  const bump = (name: string, kind: MissedExercise["kind"], count: number, total: number, plan: string | null) => {
    const key = `${kind}:${name}`;
    const m = missed.get(key) ?? { name, kind, count: 0, ...(kind === "incompleto" ? { total: 0 } : {}), plans: [] };
    m.count += count;
    if (m.total != null) m.total += total;
    if (plan && !m.plans.includes(plan)) m.plans.push(plan);
    missed.set(key, m);
  };
  const cardioItems: ReportWeekDetail["cardio"]["items"] = [];
  for (const s of input.sessions) {
    const sets = input.sets.filter((x) => x.session_id === s.id);
    const done = new Set(sets.filter((x) => x.done).map((x) => x.equipment_id));
    for (const id of s.plan_id ? (input.planItems[s.plan_id] ?? []) : []) {
      if (!sets.some((x) => x.equipment_id === id)) bump(eq(id).name, "pulado", 1, 0, s.plan_name);
    }
    for (const id of new Set(sets.map((x) => x.equipment_id))) {
      const mine = sets.filter((x) => x.equipment_id === id);
      const undone = mine.filter((x) => !x.done).length;
      if (!done.has(id)) bump(eq(id).name, "pulado", 1, 0, s.plan_name);
      else if (undone) bump(eq(id).name, "incompleto", undone, mine.length, s.plan_name);
    }
    for (const x of sets) {
      if (!x.done || !eq(x.equipment_id).cardio) continue;
      cardioItems.push({
        name: eq(x.equipment_id).name,
        date: s.date,
        line: cardioSetLine({ minutes: x.duration_min ?? x.reps, km: x.distance_km, speed: x.speed_kmh, incline: x.incline_pct, level: x.level }),
      });
    }
  }
  const rated = input.sessions.filter((s) => s.effort != null);
  const w = input.cardioWeek;
  const progress = w ? goalProgress(w) : null;
  return {
    days: new Set(input.sessions.map((s) => s.date)).size,
    weeklyGoal: input.weeklyGoal,
    minutes: Math.round(input.sessions.reduce((a, s) => a + (s.duration_seconds || 0), 0) / 60),
    missed: [...missed.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR")).slice(0, 10),
    cardio: {
      minutes: w?.minutes ?? 0,
      km: w?.km ?? 0,
      intenseMinutes: w?.intense_minutes ?? 0,
      days: w?.days ?? 0,
      items: cardioItems.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12),
      goal:
        w?.goal && progress
          ? { label: goalLabel(w.goal), value: progress.value, target: progress.target, unit: progress.unit, pct: progress.pct, done: progress.done, byPersonal: w.goal.by_personal }
          : null,
    },
    effort: {
      avg: rated.length ? Math.round((rated.reduce((a, s) => a + s.effort!, 0) / rated.length) * 10) / 10 : null,
      rated: rated.length,
      pain: input.sessions.filter((s) => s.pain).length,
      feedback: input.sessions.map((s) => s.feedback?.trim()).filter((x): x is string => !!x).slice(0, 3),
    },
    lastWorkout: input.lastWorkout,
    achievements: input.achievements.slice(0, 8),
  };
}


const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;

const first = (name: string) => name.split(" ")[0];

/** Sugestões por regras simples (usadas sempre, ao lado das IAs). No máximo 6. */
export function ruleSuggestions(s: ReportStudent): string[] {
  const out: string[] = [];
  const d = s.detail;
  if (s.sessions === 0) {
    out.push("Não treinou nesta semana: mande uma mensagem para entender o motivo e combinar os dias da próxima semana.");
    if (s.prevSessions === 0) out.push("Já são duas semanas sem treino: vale rever a rotina e propor treinos mais curtos para retomar o hábito.");
    if (d?.cardio.goal) out.push(`Meta de cardio parada (${d.cardio.goal.label}): proponha começar com uma caminhada leve de 20 min para retomar.`);
    return out;
  }
  if (d?.weeklyGoal && d.days < d.weeklyGoal)
    out.push(`Treinou ${d.days} de ${d.weeklyGoal} dias da meta semanal: combine dias e horários fixos para a próxima semana.`);
  else if (s.sessions < 3)
    out.push(`Fez ${s.sessions} ${s.sessions === 1 ? "treino" : "treinos"}: incentive a frequência, com a meta de pelo menos 3 por semana.`);
  const skipped = d?.missed.filter((m) => m.kind === "pulado").map((m) => m.name) ?? [];
  const partial = d?.missed.filter((m) => m.kind === "incompleto").map((m) => m.name) ?? [];
  if (skipped.length)
    out.push(`Deixou de fazer ${list(skipped.slice(0, 3))}: pergunte o motivo (tempo, dor, aparelho ocupado) e, se precisar, troque por uma variação.`);
  else if (partial.length)
    out.push(`Séries incompletas em ${list(partial.slice(0, 3))}: talvez a carga ou o volume estejam altos; ajuste para completar todas as séries.`);
  if (d) {
    const g = d.cardio.goal;
    if (g && !g.done)
      out.push(`Cardio abaixo da meta: ${formatAmount(g.value, g.unit)} de ${formatAmount(g.target, g.unit)}. Sugira encaixar o que falta no fim dos treinos de musculação.`);
    else if (g?.done) out.push(`Bateu a meta de cardio (${g.label}): vale parabenizar e, se estiver fácil, aumentar 10% na próxima semana.`);
    else if (!d.cardio.minutes) out.push("Não fez cardio na semana: combine 2 a 3 sessões de 20–30 min (ou defina uma meta de cardio na página do aluno).");
    if (d.effort.pain) out.push(`Relatou dor em ${d.effort.pain} ${d.effort.pain === 1 ? "treino" : "treinos"}: converse antes do próximo treino e adapte os exercícios que incomodam.`);
    else if (d.effort.avg != null && d.effort.avg >= 4.5) out.push("Esforço muito alto na semana: cuide da recuperação (sono, descanso entre séries) para evitar sobrecarga.");
    else if (d.effort.avg != null && d.effort.avg <= 2) out.push("Achou os treinos leves: dá para subir carga ou repetições com segurança.");
  }
  const same = s.exercises.filter((e) => e.trend === "same" && e.current > 0).map((e) => e.name);
  if (same.length)
    out.push(`Carga estagnada em ${list(same.slice(0, 3))}: experimente aumentar 2–5% ou subir as repetições antes de subir a carga.`);
  const down = s.exercises.filter((e) => e.trend === "down").map((e) => e.name);
  if (down.length)
    out.push(`Carga caiu em ${list(down.slice(0, 3))}: reveja volume, descanso e técnica; pode ser sinal de cansaço acumulado.`);
  const up = s.exercises.filter((e) => e.trend === "up").map((e) => e.name);
  if (up.length) out.push(`Boa evolução em ${list(up.slice(0, 3))}: mantenha a progressão gradual.`);
  if (s.prs.length) out.push(`Bateu ${s.prs.length === 1 ? "um recorde" : `${s.prs.length} recordes`}: vale parabenizar para manter a motivação!`);
  if (s.weight.visible && s.weight.change && Math.abs(s.weight.change.delta) >= 1)
    out.push(`Peso variou ${s.weight.change.delta > 0 ? "+" : ""}${s.weight.change.delta.toLocaleString("pt-BR")} kg na semana: confira se está de acordo com o objetivo.`);
  if (s.streakWeeks >= 4) out.push(`${s.streakWeeks} semanas seguidas treinando: ótima constância, reconheça o esforço.`);
  return out.slice(0, 6);
}

/** Mensagem curta de motivação para o Personal mandar ao aluno (regras). */
export function ruleMotivation(s: ReportStudent): string {
  const n = first(s.name);
  const d = s.detail;
  if (s.sessions === 0)
    return `Bora voltar, ${n}! Uma semana parada não apaga sua evolução. O treino mais importante é o próximo — te espero lá! 💪`;
  if (s.prs.length)
    return `Que semana, ${n}! ${s.prs.length === 1 ? "Recorde novo" : `${s.prs.length} recordes novos`} no ${s.prs[0].name}. Isso é resultado de constância — bora pra cima! 🏆`;
  if (d?.weeklyGoal && d.days >= d.weeklyGoal)
    return `Meta da semana batida, ${n}! ${d.days} dias de treino. Disciplina assim muda o shape e a cabeça. Bora repetir! 🎯`;
  if (d?.cardio.goal?.done) return `Mandou bem no cardio, ${n}! Meta batida. Seu coração agradece e o condicionamento só melhora. 🫀🔥`;
  if (s.streakWeeks >= 3) return `${s.streakWeeks} semanas seguidas, ${n}! Você está construindo um hábito de verdade. Continua assim! 🔥`;
  return `Boa, ${n}! ${s.sessions} ${s.sessions === 1 ? "treino" : "treinos"} nesta semana. Cada treino conta — bora manter o ritmo na próxima! 🇧🇷`;
}

const TREND_TEXT: Record<Trend, string> = { up: "aumentou", same: "manteve", down: "diminuiu", new: "primeira vez" };
const TREND_COLOR: Record<Trend, string> = { up: "#007a2e", same: "#5b6577", down: "#c2381a", new: "#8a6500" };
const TREND_ARROW: Record<Trend, string> = { up: "▲", same: "●", down: "▼", new: "★" };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const bar = (pct: number, color: string) =>
  `<div style="background:#eadfc6;border-radius:999px;height:10px;overflow:hidden;margin:4px 0"><div style="background:${color};width:${Math.max(2, pct)}%;height:10px"></div></div>`;
const h4 = (t: string) => `<p style="margin:12px 0 4px;font-weight:700;color:#002776">${t}</p>`;

/** Blocos de detalhe da semana (tempo, meta, o que faltou, cardio, esforço, conquistas) para o e-mail. */
function detailHtml(s: ReportStudent): string {
  const d = s.detail;
  if (!d) return "";
  const out: string[] = [];
  const facts: string[] = [];
  if (s.sessions) facts.push(`⏱️ ${d.minutes} min de treino em ${d.days} ${d.days === 1 ? "dia" : "dias"}`);
  if (d.weeklyGoal) facts.push(`🎯 Meta semanal: ${d.days}/${d.weeklyGoal} dias ${d.days >= d.weeklyGoal ? "✅" : ""}`);
  if (!s.sessions && d.lastWorkout) facts.push(`📅 Último treino: ${ddmm(d.lastWorkout)}`);
  if (!s.sessions && !d.lastWorkout) facts.push("📅 Ainda não registrou nenhum treino");
  if (d.effort.avg != null) facts.push(`💪 Esforço médio: ${d.effort.avg.toLocaleString("pt-BR")}/5 (${d.effort.rated} ${d.effort.rated === 1 ? "treino avaliado" : "treinos avaliados"})`);
  if (d.effort.pain) facts.push(`<span style="color:#c2381a;font-weight:700">⚠️ Relatou dor em ${d.effort.pain} ${d.effort.pain === 1 ? "treino" : "treinos"}</span>`);
  if (facts.length) out.push(`<p style="margin:0 0 8px;font-size:14px">${facts.join("<br>")}</p>`);
  if (d.effort.feedback.length)
    out.push(`<p style="margin:0 0 8px;font-size:14px;color:#5b6577">${d.effort.feedback.map((f) => `💬 “${esc(f)}”`).join("<br>")}</p>`);

  if (d.missed.length) {
    out.push(h4("🚫 Deixou de fazer"));
    out.push(
      `<ul style="margin:0;padding-left:20px;font-size:14px">${d.missed
        .map(
          (m) =>
            `<li>${esc(m.name)} — ${
              m.kind === "pulado" ? `não fez${m.count > 1 ? ` (${m.count}×)` : ""}` : `${m.count} de ${m.total} séries não feitas`
            }${m.plans.length ? ` <span style="color:#5b6577">· ${esc(m.plans.join(", "))}</span>` : ""}</li>`,
        )
        .join("")}</ul>`,
    );
  } else if (s.sessions) out.push(h4("✅ Não deixou nenhum exercício para trás"));

  const c = d.cardio;
  out.push(h4(c.minutes ? `🏃 Cardio: fez (${formatAmount(c.minutes, "min")}${c.km ? ` · ${formatAmount(c.km, "km")}` : ""} em ${c.days} ${c.days === 1 ? "dia" : "dias"})` : "🏃 Cardio: não fez nesta semana"));
  if (c.goal) {
    out.push(
      `<p style="margin:0;font-size:13px">Meta: ${esc(c.goal.label)}${c.goal.byPersonal ? "" : " (definida pelo aluno)"} — <strong>${formatAmount(c.goal.value, c.goal.unit)} de ${formatAmount(c.goal.target, c.goal.unit)}</strong> (${c.goal.pct}%) ${c.goal.done ? "✅" : ""}</p>` +
        bar(c.goal.pct, c.goal.done ? "#FFC72C" : "#e4572e"),
    );
  } else out.push(`<p style="margin:0;font-size:13px;color:#5b6577">Sem meta de cardio. Defina na página do aluno no BoraTreinar.</p>`);
  if (c.items.length)
    out.push(`<ul style="margin:4px 0 0;padding-left:20px;font-size:13px">${c.items.map((i) => `<li>${ddmm(i.date)} · ${esc(i.name)}: ${esc(i.line)}</li>`).join("")}</ul>`);

  if (d.achievements.length) {
    out.push(h4("🏆 Conquistas desbloqueadas"));
    out.push(`<p style="margin:0;font-size:14px">${d.achievements.map((a) => `${a.emoji} ${esc(a.title)}`).join(" · ")}</p>`);
  }
  return out.join("\n");
}

/** Mensagens de motivação (regras e IAs) para o Personal mandar ao aluno. */
function motivationHtml(s: ReportStudent): string {
  const msgs = [s.motivation, ...(s.aiSuggestions ?? []).map((a) => a.motivation)].filter((x): x is string => !!x);
  if (!msgs.length) return "";
  return `<div style="margin:12px 0 0;padding:12px;border-radius:12px;background:#FFF1C2">
  <p style="margin:0 0 4px;font-weight:700;color:#8a6500">💬 Mensagem de motivação para mandar ao aluno</p>
  ${msgs.map((m) => `<p style="margin:4px 0;font-size:14px">“${esc(m)}”</p>`).join("")}
</div>`;
}

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
  ${detailHtml(s)}
  ${suggestionSets(s)
    .map(
      (set) =>
        `<p style="margin:10px 0 4px;font-weight:700;color:${set.source === "regras" ? "#5b6577" : "#009C3B"}">Sugestões · ${esc(SOURCE_LABEL[set.source])}</p><ul style="margin:0;padding-left:20px;font-size:14px;list-style:disc">${set.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`,
    )
    .join("")}
  ${motivationHtml(s)}
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
