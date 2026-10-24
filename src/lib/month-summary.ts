import { addDays, addMonths, mondayOf, MONTHS } from "./schedule.ts";
import type { SummarySession } from "./stats.ts";

export type MonthSummary = {
  month: string; // YYYY-MM
  label: string; // "Outubro de 2026"
  sessions: number;
  prevSessions: number;
  activeDays: string[]; // dias com treino (YYYY-MM-DD)
  perWeek: number; // média de treinos por semana no mês (até hoje, se for o mês atual)
  weeksActive: number; // semanas (seg–dom) com pelo menos um treino
  minutes: number;
  volume: number;
  sets: number;
  prs: { id: string; load: number; date: string }[];
  topPlan: { name: string; count: number } | null;
  cardio: { minutes: number; km: number };
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Resumo de um mês de treinos (sessões vindas de `training_summary`, cardio somado à parte). */
export function monthSummary(
  all: SummarySession[],
  month: string,
  today: string,
  cardio: { minutes: number; km: number } = { minutes: 0, km: 0 },
): MonthSummary {
  const from = `${month}-01`;
  const to = addDays(`${addMonths(month, 1)}-01`, -1);
  const prev = addMonths(month, -1);
  const inMonth = all.filter((s) => s.date >= from && s.date <= to);
  const end = today < to ? today : to;
  const elapsed = Math.max(1, Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1);

  const prMap = new Map<string, { id: string; load: number; date: string }>();
  for (const s of inMonth)
    for (const x of s.ex)
      if (x.pr && Number(x.max) >= (prMap.get(x.e)?.load ?? 0)) prMap.set(x.e, { id: x.e, load: Number(x.max), date: s.date });

  const plans = new Map<string, number>();
  for (const s of inMonth) if (s.plan) plans.set(s.plan, (plans.get(s.plan) ?? 0) + 1);
  const top = [...plans].sort((a, b) => b[1] - a[1])[0];

  const [y, m] = month.split("-").map(Number);
  return {
    month,
    label: `${MONTHS[m - 1]} de ${y}`,
    sessions: inMonth.length,
    prevSessions: all.filter((s) => s.date.startsWith(prev)).length,
    activeDays: [...new Set(inMonth.map((s) => s.date))].sort(),
    perWeek: round1((inMonth.length / elapsed) * 7),
    weeksActive: new Set(inMonth.map((s) => mondayOf(s.date))).size,
    minutes: Math.round(inMonth.reduce((a, s) => a + s.duration, 0) / 60),
    volume: round1(inMonth.reduce((a, s) => a + s.ex.reduce((b, x) => b + Number(x.vol), 0), 0)),
    sets: inMonth.reduce((a, s) => a + s.ex.reduce((b, x) => b + Number(x.sets), 0), 0),
    prs: [...prMap.values()].sort((a, b) => b.load - a.load),
    topPlan: top ? { name: top[0], count: top[1] } : null,
    cardio: { minutes: Math.round(cardio.minutes), km: round1(cardio.km) },
  };
}

/** Texto para compartilhar (WhatsApp, legenda do Instagram). */
export function monthShareText(s: MonthSummary, names: Record<string, string>): string {
  const lines = [
    `💪 Meu ${s.label.split(" de ")[0].toLowerCase()} no BoraTreinar`,
    `🏋️ ${s.sessions} ${s.sessions === 1 ? "treino" : "treinos"} em ${s.activeDays.length} ${s.activeDays.length === 1 ? "dia" : "dias"} (${s.perWeek.toLocaleString("pt-BR")} por semana)`,
  ];
  if (s.minutes)
    lines.push(
      `⏱️ ${s.minutes >= 60 ? `${Math.floor(s.minutes / 60)}h${String(s.minutes % 60).padStart(2, "0")}` : `${s.minutes} min`} treinando`,
    );
  if (s.volume) lines.push(`📦 ${Math.round(s.volume).toLocaleString("pt-BR")} kg levantados`);
  if (s.cardio.minutes)
    lines.push(`🏃 ${s.cardio.minutes} min de cardio${s.cardio.km ? ` · ${s.cardio.km.toLocaleString("pt-BR")} km` : ""}`);
  if (s.prs.length)
    lines.push(
      `🏆 ${s.prs.length} ${s.prs.length === 1 ? "recorde" : "recordes"}: ${s.prs
        .slice(0, 3)
        .map((p) => `${names[p.id] ?? "exercício"} ${p.load.toLocaleString("pt-BR")} kg`)
        .join(", ")}`,
    );
  lines.push("Bora treinar! 🇧🇷");
  return lines.join("\n");
}
