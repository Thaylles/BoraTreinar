import type { Metadata } from "next";
import { History } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/ui/card";
import { SessionList } from "@/components/workout/session-list";
import { requireRole } from "@/lib/auth";
import { listSessions } from "@/lib/sessions-server";

export const metadata: Metadata = { title: "Histórico" };

export default async function HistoricoPage() {
  const { profile } = await requireRole("aluno");
  const sessions = await listSessions(profile.id, 60);
  return (
    <>
      <PageTitle sub="Todos os treinos que você já registrou.">Histórico</PageTitle>
      {!sessions.length ? (
        <EmptyState icon={<History className="size-8" />} title="Nenhum treino ainda">
          Escolha uma ficha no início e bora!
        </EmptyState>
      ) : (
        <SessionList sessions={sessions} href={(id) => `/aluno/historico/${id}`} />
      )}
    </>
  );
}
