import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { OccurrenceList } from "@/components/agenda/occurrence-list";
import { ScheduleForm } from "@/components/agenda/schedule-form";
import { ChangeRequestCard } from "@/components/agenda/change-request-card";
import { MonthGrid } from "@/components/agenda/month-grid";
import { requireRole } from "@/lib/auth";
import { loadAgenda } from "@/lib/agenda-server";
import { createClient } from "@/lib/supabase/server";
import { spDateKey } from "@/lib/week";
import { MONTHS, WEEKDAYS, WEEKDAYS_SHORT, addDays, addMonths, dayLabel, mondayOf, monthGrid, weekdayOf } from "@/lib/schedule";

export const metadata: Metadata = { title: "Agenda" };

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMonth = (s?: string) => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string }> }) {
  const { profile } = await requireRole("personal");
  const sp = await searchParams;
  const supabase = await createClient();

  // Mês exibido: ?mes=, senão o do dia escolhido, senão o atual (fuso de São Paulo).
  const today = spDateKey();
  const month = isMonth(sp.mes) ? sp.mes! : isDate(sp.dia) ? sp.dia!.slice(0, 7) : today.slice(0, 7);
  const selected = isDate(sp.dia) && sp.dia!.startsWith(month) ? sp.dia! : today.startsWith(month) ? today : `${month}-01`;

  const grid = monthGrid(month);
  const [{ occurrences }, { data: links }, { data: changeRequests }] = await Promise.all([
    loadAgenda({ personalId: profile.id, from: grid.start, days: grid.days }),
    supabase
      .from("personal_students")
      .select("student:profiles!personal_students_student_id_fkey(id, full_name)")
      .eq("personal_id", profile.id)
      .eq("status", "ativo")
      .is("archived_at", null),
    supabase
      .from("class_change_requests")
      .select(
        "id, on_date, new_date, new_time, note, student:profiles!class_change_requests_student_id_fkey(full_name), schedule:class_schedules!class_change_requests_schedule_id_fkey(start_time)",
      )
      .eq("personal_id", profile.id)
      .eq("status", "pendente")
      .gte("on_date", today)
      .order("on_date"),
  ]);
  const students = (links ?? [])
    .map((l) => l.student)
    .filter((s): s is { id: string; full_name: string } => !!s)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

  const byDay = new Map<string, typeof occurrences>();
  for (const o of occurrences) byDay.set(o.date, [...(byDay.get(o.date) ?? []), o]);

  const dayOcc = byDay.get(selected) ?? [];
  const weekStart = mondayOf(selected);
  const weekEnd = addDays(weekStart, 6);
  const weekOcc = occurrences.filter((o) => o.date >= weekStart && o.date <= weekEnd && !o.cancelled);
  const weekStudents = new Map<string, { name: string; slots: string[] }>();
  for (const o of weekOcc) {
    const id = o.schedule.student?.id ?? o.schedule.id;
    const entry = weekStudents.get(id) ?? { name: o.schedule.student?.full_name ?? "Aluno", slots: [] };
    entry.slots.push(`${WEEKDAYS_SHORT[weekdayOf(o.date)]} ${o.time}`);
    weekStudents.set(id, entry);
  }
  const monthTotal = occurrences.filter((o) => o.date.startsWith(month) && !o.cancelled).length;
  const href = (m: string, d?: string) => `/personal/agenda?mes=${m}${d ? `&dia=${d}` : ""}`;

  return (
    <>
      <PageTitle sub="Aulas semanais se repetem todo mês até você remover. Toque num dia para ver e ajustar.">Agenda</PageTitle>

      {!!changeRequests?.length && (
        <section aria-labelledby="trocas" className="mb-6">
          <h2 id="trocas" className="mb-2 font-display text-xl font-bold">
            Pedidos de troca de aula ({changeRequests.length})
          </h2>
          <div className="space-y-3">
            {changeRequests.map((r) => (
              <ChangeRequestCard key={r.id} request={r} />
            ))}
          </div>
        </section>
      )}

      <section aria-label="Calendário do mês" className="mb-6 rounded-3xl border border-border bg-surface p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link href={href(addMonths(month, -1))} className="rounded-xl p-2 hover:bg-border/50" aria-label="Mês anterior">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div className="text-center">
            <h2 className="font-display text-xl font-bold">
              {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
            </h2>
            <p className="text-xs text-muted">
              {monthTotal} {monthTotal === 1 ? "aula" : "aulas"} no mês
              {!today.startsWith(month) && (
                <>
                  {" · "}
                  <Link href={href(today.slice(0, 7), today)} className="font-semibold text-bandeira-600 underline dark:text-bandeira-100">
                    voltar para hoje
                  </Link>
                </>
              )}
            </p>
          </div>
          <Link href={href(addMonths(month, 1))} className="rounded-xl p-2 hover:bg-border/50" aria-label="Próximo mês">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
        <MonthGrid month={month} start={grid.start} days={grid.days} today={today} selected={selected} occurrences={occurrences} />
      </section>

      <section className="mb-6" aria-labelledby="dia-sel">
        <h2 id="dia-sel" className="mb-2 font-display text-xl font-bold">
          {dayLabel(selected, today)}
          {(selected === today || selected === addDays(today, 1)) && <span className="text-muted">, {ddmm(selected)}</span>}
        </h2>
        {dayOcc.length ? (
          <OccurrenceList occurrences={dayOcc} today={today} managerId={profile.id} showStudent hideDayHeader />
        ) : (
          <p className="text-sm text-muted">Nenhuma aula neste dia.</p>
        )}
        {selected >= today && (
          <details className="mt-3 rounded-3xl border border-border bg-surface p-4">
            <summary className="cursor-pointer font-display font-bold">+ Agendar aula ({WEEKDAYS[weekdayOf(selected)].toLowerCase()}, {ddmm(selected)})</summary>
            <div className="mt-4">
              {students.length ? (
                <ScheduleForm key={selected} students={students} today={today} date={selected} />
              ) : (
                <p className="text-sm text-muted">Convide um aluno primeiro.</p>
              )}
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="semana">
        <h2 id="semana" className="mb-2 font-display text-xl font-bold">
          Semana de {ddmm(weekStart)} a {ddmm(weekEnd)}
        </h2>
        {weekStudents.size ? (
          <ul className="space-y-2">
            {[...weekStudents.values()]
              .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
              .map((s) => (
                <li key={s.name + s.slots[0]} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-3 py-2 text-sm">
                  <span className="truncate font-semibold">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">{s.slots.join(" · ")}</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhuma aula nesta semana.</p>
        )}
      </section>
    </>
  );
}
