import "server-only";
import type { BackdateInfo } from "@/components/workout/workout-runner";
import { dayLabel } from "@/lib/schedule";
import { parseBackdate } from "@/lib/session-window";
import { spDateKey, spMidnightISO, spTimeKey } from "@/lib/week";

/** Treino esquecido a partir da URL (`passado`, `min`), já validado; null se não veio ou é inválido. */
export function resolveBackdate(passado: string | undefined, min: string | undefined): BackdateInfo | null {
  const today = spDateKey();
  const b = parseBackdate(passado, min, today, spTimeKey());
  if (!b) return null;
  const [h, m] = b.time.split(":").map(Number);
  const startedAt = new Date(Date.parse(spMidnightISO(b.date)) + (h * 60 + m) * 60_000).toISOString();
  return { startedAt, minutes: b.minutes, label: `${dayLabel(b.date, today).toLowerCase()} às ${b.time}` };
}

/** Parte da URL que leva o treino esquecido adiante ("&passado=…&min=…"), ou "". */
export const backdateQuery = (passado?: string, min?: string) =>
  passado && min ? `passado=${encodeURIComponent(passado)}&min=${encodeURIComponent(min)}` : "";
