import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, History } from "lucide-react";
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
      <Link
        href="/aluno/registrar-passado"
        className="mb-4 inline-flex items-center gap-2 rounded-2xl border-2 border-dashed border-bandeira-500/60 px-4 py-2.5 text-sm font-bold text-bandeira-700 hover:bg-bandeira-50 dark:text-bandeira-100 dark:hover:bg-bandeira-500/10"
      >
        <CalendarPlus className="size-4" aria-hidden /> Registrar treino esquecido (últimos 7 dias)
      </Link>
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
