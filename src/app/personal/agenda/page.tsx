import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/ui/card";
import { OccurrenceList } from "@/components/agenda/occurrence-list";
import { requireRole } from "@/lib/auth";
import { loadAgenda } from "@/lib/agenda-server";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  const { profile } = await requireRole("personal");
  const { occurrences, today } = await loadAgenda({ personalId: profile.id, days: 14 });
  return (
    <>
      <PageTitle sub="Suas aulas presenciais dos próximos 14 dias.">Agenda</PageTitle>
      {!occurrences.length ? (
        <EmptyState icon={<CalendarDays className="size-8" />} title="Nenhuma aula agendada">
          Agende aulas recorrentes na página de cada aluno.
        </EmptyState>
      ) : (
        <OccurrenceList occurrences={occurrences} today={today} managerId={profile.id} showStudent />
      )}
    </>
  );
}
