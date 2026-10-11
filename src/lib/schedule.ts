export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export type ScheduleLike = {
  id: string;
  weekday: number;
  start_time: string; // "HH:MM" ou "HH:MM:SS"
  duration_minutes: number;
  starts_on: string; // "YYYY-MM-DD"
  ends_on: string | null;
};

export type Occurrence<S extends ScheduleLike> = {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  schedule: S;
  cancelled: boolean;
  reason: string | null;
};

/** Soma dias a uma data civil "YYYY-MM-DD" (sem fuso). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Dia da semana (0 = domingo) de uma data civil. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Próximas ocorrências das aulas recorrentes a partir de `from` (inclusive), por `days` dias,
 * marcando as datas canceladas. Ordenadas por data e horário.
 */
export function upcomingOccurrences<S extends ScheduleLike>(
  schedules: S[],
  exceptions: { schedule_id: string; on_date: string; reason: string | null }[],
  from: string,
  days: number,
): Occurrence<S>[] {
  const cancelled = new Map(exceptions.map((e) => [`${e.schedule_id}|${e.on_date}`, e.reason]));
  const out: Occurrence<S>[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const wd = weekdayOf(date);
    for (const s of schedules) {
      if (s.weekday !== wd || date < s.starts_on || (s.ends_on && date > s.ends_on)) continue;
      const key = `${s.id}|${date}`;
      out.push({
        date,
        time: s.start_time.slice(0, 5),
        schedule: s,
        cancelled: cancelled.has(key),
        reason: cancelled.get(key) ?? null,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return "Hoje";
  if (date === addDays(today, 1)) return "Amanhã";
  return `${WEEKDAYS[weekdayOf(date)]}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}
