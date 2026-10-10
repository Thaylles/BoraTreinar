import { TIMEZONE } from "@/lib/env";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (iso: string | Date) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string | Date) => dateTimeFmt.format(new Date(iso));

/** "há 3 dias", "em 5 dias"… */
export function relativeDays(iso: string | Date, now = new Date()): string {
  const diff = Math.round((new Date(iso).getTime() - now.getTime()) / 86_400_000);
  return new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }).format(diff, "day");
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
