import { addDays, addMonths, mondayOf, MONTHS } from "./schedule.ts";

/** Exercício agregado de uma sessão (vem de `training_summary`). */
export type SummaryExercise = { e: string; max: number; vol: number; sets: number; reps: number; pr: boolean };
export type SummarySession = {
  id: string;
  started_at: string;
  date: string; // dia civil em São Paulo
  kind: "ficha" | "livre";
  plan?: string | null; // nome da ficha (treino de ficha)
  duration: number; // segundos
  ex: SummaryExercise[];
};

export type PeriodKind = "semana" | "mes";
export type Period = { kind: PeriodKind; from: string; to: string; prevFrom: string; prevTo: string; label: string };

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Semana (seg–dom) ou mês civil que contém `ref`, com o período anterior para comparação. */
export function periodFor(kind: PeriodKind, ref: string): Period {
  if (kind === "semana") {
    const from = mondayOf(ref);
    const to = addDays(from, 6);
    return { kind, from, to, prevFrom: addDays(from, -7), prevTo: addDays(from, -1), label: `${ddmm(from)} a ${ddmm(to)}` };
  }
  const month = ref.slice(0, 7);
  const from = `${month}-01`;
  const to = addDays(`${addMonths(month, 1)}-01`, -1);
  const prevFrom = `${addMonths(month, -1)}-01`;
  return {
    kind,
    from,
    to,
    prevFrom,
    prevTo: addDays(from, -1),
    label: `${MONTHS[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`,
  };
}

/** Data de referência do período anterior (-1) ou seguinte (+1). */
export function shiftPeriod(p: Period, dir: -1 | 1): string {
  return p.kind === "semana" ? addDays(p.from, 7 * dir) : `${addMonths(p.from.slice(0, 7), dir)}-01`;
}

export type Totals = { sessions: number; volume: number; sets: number; minutes: number };
export type Trend = "up" | "same" | "down" | "new";
export type ExerciseProgress = { id: string; current: number; previous: number | null; delta: number; trend: Trend };
export type Dashboard = {
  totals: Totals;
  prevTotals: Totals;
  progress: ExerciseProgress[];
  topGains: ExerciseProgress[];
  prs: { id: string; load: number; date: string }[];
  streakWeeks: number;
  bestVolume: { date: string; volume: number; allTime: boolean } | null;
  weeks: { week: string; sessions: number; volume: number }[];
};

const sessionVolume = (s: SummarySession) => s.ex.reduce((a, x) => a + Number(x.vol), 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

function totals(sessions: SummarySession[]): Totals {
  return {
    sessions: sessions.length,
    volume: round1(sessions.reduce((a, s) => a + sessionVolume(s), 0)),
    sets: sessions.reduce((a, s) => a + s.ex.reduce((b, x) => b + Number(x.sets), 0), 0),
    minutes: Math.round(sessions.reduce((a, s) => a + s.duration, 0) / 60),
  };
}

/**
 * Indicadores do período: totais (e do período anterior), progressão de carga por exercício
 * (maior carga no período × maior carga da última sessão anterior com o exercício),
 * recordes, sequência de semanas treinando, maior volume e frequência das últimas 8 semanas.
 */
export function computeDashboard(all: SummarySession[], period: Period, today: string): Dashboard {
  const sessions = [...all].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const inPeriod = sessions.filter((s) => s.date >= period.from && s.date <= period.to);
  const inPrev = sessions.filter((s) => s.date >= period.prevFrom && s.date <= period.prevTo);
  const before = sessions.filter((s) => s.date < period.from);

  // Progressão por exercício
  const current = new Map<string, number>();
  for (const s of inPeriod) for (const x of s.ex) current.set(x.e, Math.max(current.get(x.e) ?? 0, Number(x.max)));
  const progress: ExerciseProgress[] = [...current].map(([id, cur]) => {
    const last = [...before].reverse().find((s) => s.ex.some((x) => x.e === id));
    const prev = last ? Number(last.ex.find((x) => x.e === id)!.max) : null;
    const delta = prev === null ? 0 : round1(cur - prev);
    const trend: Trend = prev === null ? "new" : delta > 0 ? "up" : delta < 0 ? "down" : "same";
    return { id, current: cur, previous: prev, delta, trend };
  });
  const order: Record<Trend, number> = { up: 0, new: 1, same: 2, down: 3 };
  progress.sort((a, b) => order[a.trend] - order[b.trend] || b.delta - a.delta);
  const topGains = progress
    .filter((p) => p.trend === "up")
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  // Recordes no período (um por exercício, a maior carga)
  const prMap = new Map<string, { id: string; load: number; date: string }>();
  for (const s of inPeriod)
    for (const x of s.ex)
      if (x.pr && Number(x.max) >= (prMap.get(x.e)?.load ?? 0)) prMap.set(x.e, { id: x.e, load: Number(x.max), date: s.date });
  const prs = [...prMap.values()].sort((a, b) => b.date.localeCompare(a.date));

  // Semanas (seg–dom) com treino
  const end = period.to < today ? period.to : today;
  const endWeek = mondayOf(end);
  const perWeek = new Map<string, { sessions: number; volume: number }>();
  for (const s of sessions) {
    if (s.date > end) continue;
    const w = mondayOf(s.date);
    const cur = perWeek.get(w) ?? { sessions: 0, volume: 0 };
    perWeek.set(w, { sessions: cur.sessions + 1, volume: round1(cur.volume + sessionVolume(s)) });
  }
  // A semana em andamento sem treino ainda não quebra a sequência.
  let w = perWeek.has(endWeek) || endWeek !== mondayOf(today) ? endWeek : addDays(endWeek, -7);
  let streakWeeks = 0;
  while (perWeek.has(w)) {
    streakWeeks++;
    w = addDays(w, -7);
  }
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const week = addDays(endWeek, -7 * (7 - i));
    return { week, ...(perWeek.get(week) ?? { sessions: 0, volume: 0 }) };
  });

  // Maior volume do período (e se é o maior de todos até então)
  let bestVolume: Dashboard["bestVolume"] = null;
  for (const s of inPeriod) {
    const v = round1(sessionVolume(s));
    if (v > 0 && (!bestVolume || v > bestVolume.volume)) bestVolume = { date: s.date, volume: v, allTime: false };
  }
  if (bestVolume) {
    const bv = bestVolume.volume;
    bestVolume.allTime = sessions.filter((s) => s.date <= period.to).every((s) => sessionVolume(s) <= bv);
  }

  return { totals: totals(inPeriod), prevTotals: totals(inPrev), progress, topGains, prs, streakWeeks, bestVolume, weeks };
}

/** Variação do peso no período: primeira × última pesagem dentro dele. */
export function weightChange(weights: { measured_on: string; weight_kg: number }[], period: Period) {
  const inP = weights.filter((w) => w.measured_on >= period.from && w.measured_on <= period.to).sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  if (!inP.length) return null;
  return { first: inP[0].weight_kg, last: inP[inP.length - 1].weight_kg, delta: round1(inP[inP.length - 1].weight_kg - inP[0].weight_kg), count: inP.length };
}

/** "12.345 kg" */
export function formatKg(n: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n)} kg`;
}
