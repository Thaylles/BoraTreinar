/** Treino esquecido: até quantos dias atrás o app aceita registrar (o banco confere de novo). */
export const BACKDATE_MAX_DAYS = 7;

export type Backdate = { date: string; time: string; minutes: number };

const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/**
 * Lê o treino esquecido da URL (`passado=YYYY-MM-DDTHH:MM`, `min=60`). Só vale de hoje até
 * 7 dias atrás (calendário de São Paulo), sem horário no futuro e com 5 a 300 minutos.
 */
export function parseBackdate(passado: string | undefined, min: string | undefined, today: string, nowTime: string): Backdate | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(passado ?? "");
  const minutes = Number(min);
  if (!m || !Number.isInteger(minutes) || minutes < 5 || minutes > 300) return null;
  const [, date, time] = m;
  if (Number(time.slice(0, 2)) > 23 || Number(time.slice(3)) > 59) return null;
  if (date > today || date < addDays(today, -BACKDATE_MAX_DAYS)) return null;
  if (date === today && time > nowTime) return null;
  return { date, time, minutes };
}

/** Dias que dá para escolher no treino esquecido: hoje e os 7 anteriores. */
export const backdateDays = (today: string) => Array.from({ length: BACKDATE_MAX_DAYS + 1 }, (_, i) => addDays(today, -i));

/**
 * Início e fim que o treino vai gravar.
 * - Treino esquecido: começa no horário informado e dura o informado (ou o tempo do cardio, se só teve cardio).
 * - Só cardio: a duração é o tempo do cardio, terminando agora.
 * - Normal: do início real até agora.
 */
export function sessionWindow(o: {
  startedAt: string;
  now: string;
  cardioOnlyMinutes: number | null;
  backdate?: { startedAt: string; minutes: number } | null;
}): { started_at: string; finished_at: string } {
  const ms = (min: number) => Math.round(min * 60_000);
  if (o.backdate) {
    const start = Date.parse(o.backdate.startedAt);
    return {
      started_at: new Date(start).toISOString(),
      finished_at: new Date(start + ms(o.cardioOnlyMinutes ?? o.backdate.minutes)).toISOString(),
    };
  }
  if (o.cardioOnlyMinutes) {
    const end = Date.parse(o.now);
    return { started_at: new Date(end - ms(o.cardioOnlyMinutes)).toISOString(), finished_at: new Date(end).toISOString() };
  }
  return { started_at: o.startedAt, finished_at: o.now };
}

/** Minutos de cardio quando o treino só teve séries de cardio feitas (senão null). */
export function cardioOnlyMinutes(sets: { cardio: boolean; done: boolean; minutes: number }[]): number | null {
  const done = sets.filter((s) => s.done);
  if (!done.length || done.some((s) => !s.cardio)) return null;
  const total = done.reduce((a, s) => a + s.minutes, 0);
  return total > 0 ? total : null;
}
