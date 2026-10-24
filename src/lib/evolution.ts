import { addDays, mondayOf } from "./schedule.ts";
import type { SummarySession } from "./stats.ts";

const round1 = (n: number) => Math.round(n * 10) / 10;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Força estimada (1RM) pela fórmula de Epley; só vale para séries de 1 a 12 repetições. */
export function estimateOneRm(load: number, reps: number): number | null {
  if (!(load > 0) || reps < 1 || reps > 12) return null;
  return round1(load * (1 + reps / 30));
}

export type GroupVolume = {
  group: string;
  weeks: number[];
  volume: number[];
  avg: number;
};

/**
 * Séries feitas por grupo muscular nas últimas `count` semanas (seg–dom, a última é a atual).
 * Cardio fica de fora. Ordenado pela média de séries, do maior para o menor.
 */
export function weeklyVolumeByGroup(
  sessions: SummarySession[],
  groupOf: Record<string, string | null | undefined>,
  today: string,
  count = 4,
): { weeks: string[]; groups: GroupVolume[] } {
  const current = mondayOf(today);
  const weeks = Array.from({ length: count }, (_, i) => addDays(current, -7 * (count - 1 - i)));
  const map = new Map<string, GroupVolume>();
  for (const s of sessions) {
    const wi = weeks.indexOf(mondayOf(s.date));
    if (wi < 0 || s.date > today) continue;
    for (const x of s.ex) {
      const group = groupOf[x.e];
      if (!group || group === "cardio") continue;
      const g = map.get(group) ?? {
        group,
        weeks: Array(count).fill(0),
        volume: Array(count).fill(0),
        avg: 0,
      };
      g.weeks[wi] += Number(x.sets);
      g.volume[wi] = round1(g.volume[wi] + Number(x.vol));
      map.set(group, g);
    }
  }
  const groups = [...map.values()].map((g) => ({
    ...g,
    avg: round1(g.weeks.reduce((a, b) => a + b, 0) / count),
  }));
  return { weeks, groups: groups.sort((a, b) => b.avg - a.avg) };
}

export type StrengthTrend = {
  id: string;
  current: number;
  previous: number | null;
  deltaPct: number | null;
  date: string;
};

/**
 * 1RM estimado por exercício: melhor das últimas 4 semanas × melhor das 4 semanas anteriores.
 * Só exercícios feitos nas últimas 4 semanas, do mais forte para o mais fraco.
 */
export function strengthTrends(sessions: SummarySession[], today: string): StrengthTrend[] {
  const from = addDays(today, -27);
  const prevFrom = addDays(today, -55);
  const cur = new Map<string, { rm: number; date: string }>();
  const prev = new Map<string, number>();
  for (const s of sessions) {
    if (s.date > today || s.date < prevFrom) continue;
    for (const x of s.ex) {
      const rm = Number(x.rm ?? 0);
      if (!(rm > 0)) continue;
      if (s.date >= from) {
        if (rm > (cur.get(x.e)?.rm ?? 0)) cur.set(x.e, { rm, date: s.date });
      } else prev.set(x.e, Math.max(prev.get(x.e) ?? 0, rm));
    }
  }
  return [...cur]
    .map(([id, c]) => {
      const p = prev.get(id) ?? null;
      return {
        id,
        current: c.rm,
        previous: p,
        deltaPct: p ? round1(((c.rm - p) / p) * 100) : null,
        date: c.date,
      };
    })
    .sort((a, b) => b.current - a.current);
}

export type Stagnation = {
  id: string;
  weeks: number;
  load: number;
  sessions: number;
};

/**
 * Exercícios parados: ainda treinados (nas últimas 2 semanas), há `minWeeks`+ semanas sem subir a carga
 * máxima nem a força estimada, com pelo menos 2 treinos desde a última evolução.
 */
export function stagnationAlerts(sessions: SummarySession[], today: string, minWeeks = 3): Stagnation[] {
  const sorted = [...sessions].filter((s) => s.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const per = new Map<
    string,
    {
      best: number;
      bestRm: number;
      lastUp: string;
      since: number;
      last: string;
    }
  >();
  for (const s of sorted)
    for (const x of s.ex) {
      const load = Number(x.max);
      const rm = Number(x.rm ?? 0);
      if (!(load > 0)) continue;
      const e = per.get(x.e);
      if (!e)
        per.set(x.e, {
          best: load,
          bestRm: rm,
          lastUp: s.date,
          since: 0,
          last: s.date,
        });
      else {
        if (load > e.best || rm > e.bestRm) {
          e.best = Math.max(e.best, load);
          e.bestRm = Math.max(e.bestRm, rm);
          e.lastUp = s.date;
          e.since = 0;
        } else if (s.date !== e.last) e.since++;
        e.last = s.date;
      }
    }
  const out: Stagnation[] = [];
  for (const [id, e] of per) {
    const weeks = Math.floor(daysBetween(e.lastUp, today) / 7);
    if (weeks >= minWeeks && e.since >= 2 && daysBetween(e.last, today) <= 14) out.push({ id, weeks, load: e.best, sessions: e.since });
  }
  return out.sort((a, b) => b.weeks - a.weeks);
}
