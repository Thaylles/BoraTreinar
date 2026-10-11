import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/ui/card";
import { OccurrenceList } from "@/components/agenda/occurrence-list";
import { requireRole } from "@/lib/auth";
import { loadAgenda } from "@/lib/agenda-server";

export const metadata: Metadata = { title: "Minhas aulas" };

export default async function AlunoAulasPage() {
  const { profile } = await requireRole("aluno");
  const { occurrences, today } = await loadAgenda({ studentId: profile.id, days: 21 });
  return (
    <>
      <PageTitle sub="Aulas presenciais com seu Personal nas próximas 3 semanas.">Minhas aulas</PageTitle>
      {!occurrences.length ? (
        <EmptyState icon={<CalendarDays className="size-8" />} title="Nenhuma aula agendada">
          Quando seu Personal marcar aulas presenciais, elas aparecem aqui.
        </EmptyState>
      ) : (
        <OccurrenceList occurrences={occurrences} today={today} showPersonal />
      )}
    </>
  );
}
