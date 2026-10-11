import Link from "next/link";
import { WEEKDAYS_SHORT, addDays, dayLabel, type Occurrence, type ScheduleLike } from "@/lib/schedule";
import { cn } from "@/lib/cn";

const HEADER = [1, 2, 3, 4, 5, 6, 0].map((d) => WEEKDAYS_SHORT[d]);
const firstName = (n?: string | null) => (n ?? "").split(" ")[0];

type S = ScheduleLike & { student: { full_name: string } | null };

/** Grade do mês (seg–dom) com os alunos de cada dia; cada dia é um link para `?mes=&dia=`. */
export function MonthGrid({
  month,
  start,
  days,
  today,
  selected,
  occurrences,
}: {
  month: string;
  start: string;
  days: number;
  today: string;
  selected: string;
  occurrences: Occurrence<S>[];
}) {
  const byDay = new Map<string, Occurrence<S>[]>();
  for (const o of occurrences) byDay.set(o.date, [...(byDay.get(o.date) ?? []), o]);
  const href = (d: string) => `/personal/agenda?mes=${month}&dia=${d}`;
  return (
    <>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted" aria-hidden>
          {HEADER.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: days }, (_, i) => {
            const date = addDays(start, i);
            const inMonth = date.startsWith(month);
            const active = (byDay.get(date) ?? []).filter((o) => !o.cancelled);
            const hasCancelled = (byDay.get(date) ?? []).some((o) => o.cancelled);
            const isSel = date === selected;
            return (
              <Link
                key={date}
                href={href(date)}
                scroll={false}
                aria-current={isSel ? "date" : undefined}
                aria-label={`${dayLabel(date, today)}: ${active.length ? active.map((o) => `${o.time} ${o.schedule.student?.full_name}`).join(", ") : "sem aulas"}`}
                className={cn(
                  "flex min-h-16 flex-col rounded-xl border p-1 text-left transition sm:min-h-24 sm:p-1.5",
                  isSel ? "border-bandeira-500 ring-2 ring-bandeira-500/30" : "border-transparent hover:border-border",
                  inMonth ? "bg-background" : "opacity-40",
                  date < today && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "mb-0.5 inline-flex size-6 items-center justify-center self-start rounded-full text-xs font-bold tabular-nums",
                    date === today && "bg-bandeira-500 text-white",
                  )}
                >
                  {Number(date.slice(8, 10))}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  {active.slice(0, 2).map((o) => (
                    <span
                      key={o.schedule.id}
                      className="truncate rounded bg-bandeira-50 px-0.5 text-[10px] leading-4 font-semibold text-bandeira-700 sm:text-xs dark:bg-bandeira-500/20 dark:text-bandeira-100"
                    >
                      <span className="hidden sm:inline">{o.time} </span>
                      {firstName(o.schedule.student?.full_name)}
                    </span>
                  ))}
                  {active.length > 2 && <span className="text-[10px] font-bold text-muted">+{active.length - 2}</span>}
                  {!active.length && hasCancelled && <span className="text-[10px] font-semibold text-pitanga-600"><span aria-hidden className="sm:hidden">✕</span><span className="hidden sm:inline">cancelada</span></span>}
                </span>
              </Link>
            );
          })}
        </div>
    </>
  );
}
