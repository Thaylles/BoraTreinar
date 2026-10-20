import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { SessionDetail } from "@/components/workout/session-detail";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { requireRole } from "@/lib/auth";
import { loadSession } from "@/lib/sessions-server";
import { deleteSession } from "@/app/treino-actions";
import { SessionRating } from "@/components/workout/session-rating";
import { SessionComments } from "@/components/workout/session-comments";

export const metadata: Metadata = { title: "Treino" };

export default async function AlunoSessaoPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { profile } = await requireRole("aluno");
  const data = await loadSession(sessionId);
  if (!data || data.session.student_id !== profile.id) notFound();

  return (
    <>
      <Link href="/aluno/historico" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Histórico
      </Link>
      <SessionDetail data={data} exerciseHref={(id) => `/aluno/exercicios/${id}`} />
      {data.session.effort == null && Date.parse(data.session.finished_at) > Date.now() - 7 * 86_400_000 && (
        <div className="mt-6">
          <SessionRating sessionId={sessionId} />
        </div>
      )}
      <SessionComments sessionId={sessionId} meId={profile.id} placeholder="Conte como foi ou tire uma dúvida com seu Personal…" />
      <form action={deleteSession} className="mt-8">
        <input type="hidden" name="id" value={sessionId} />
        <ConfirmSubmit
          message="Excluir este treino do histórico?"
          className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15"
        >
          <Trash2 className="size-4" aria-hidden /> Excluir treino
        </ConfirmSubmit>
      </form>
    </>
  );
}
