import { TIMEZONE } from "@/lib/env";

/** "YYYY-MM-DD" da data no fuso de São Paulo. */
export function spDateKey(d: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(d));
}

/** Deslocamento do fuso em "±HH:MM" para a data (Brasil não tem horário de verão desde 2019, mas não assumimos). */
function spOffset(d: Date): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, timeZoneName: "longOffset" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = part?.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "-03:00";
}

/** Instante (ISO) da segunda-feira 00:00 da semana de `d`, no fuso de São Paulo. */
export function startOfWeekSP(d: Date = new Date()): string {
  const key = spDateKey(d);
  const [y, m, day] = key.split("-").map(Number);
  const local = new Date(Date.UTC(y, m - 1, day));
  const dow = (local.getUTCDay() + 6) % 7; // 0 = segunda
  local.setUTCDate(local.getUTCDate() - dow);
  const monday = local.toISOString().slice(0, 10);
  return new Date(`${monday}T00:00:00${spOffset(d)}`).toISOString();
}

/** Dias inteiros (calendário SP) entre a data e hoje. */
export function daysAgoSP(d: Date | string, now: Date = new Date()): number {
  const a = Date.parse(`${spDateKey(d)}T00:00:00Z`);
  const b = Date.parse(`${spDateKey(now)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function daysAgoLabel(days: number): string {
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}
