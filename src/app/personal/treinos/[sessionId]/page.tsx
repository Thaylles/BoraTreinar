import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { SessionDetail } from "@/components/workout/session-detail";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { requireRole } from "@/lib/auth";
import { loadSession } from "@/lib/sessions-server";
import { deleteSession } from "@/app/treino-actions";

export const metadata: Metadata = { title: "Treino do aluno" };

export default async function PersonalSessaoPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { profile } = await requireRole("personal");
  const data = await loadSession(sessionId);
  if (!data) notFound();
  const studentId = data.session.student_id;

  return (
    <>
      <Link href={`/personal/alunos/${studentId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Aluno
      </Link>
      <SessionDetail data={data} exerciseHref={(id) => `/personal/alunos/${studentId}/exercicios/${id}`} />
      {data.session.logged_by === profile.id && (
        <form action={deleteSession} className="mt-8">
          <input type="hidden" name="id" value={sessionId} />
          <ConfirmSubmit
            message="Excluir este registro de treino?"
            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15"
          >
            <Trash2 className="size-4" aria-hidden /> Excluir registro
          </ConfirmSubmit>
        </form>
      )}
    </>
  );
}
