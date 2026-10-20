import { MessageCircle, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CommentForm } from "@/components/workout/comment-form";
import { deleteSessionComment } from "@/app/treino-actions";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Conversa entre aluno e Personal sobre um treino feito. */
export async function SessionComments({ sessionId, meId, placeholder }: { sessionId: string; meId: string; placeholder: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_comments")
    .select("id, body, created_at, author_id, author:profiles!session_comments_author_id_fkey(full_name, avatar_path)")
    .eq("session_id", sessionId)
    .order("created_at");
  if (error) return null; // banco ainda sem a tabela de comentários
  const comments = data ?? [];
  return (
    <section aria-labelledby="comentarios" className="mt-8">
      <h2 id="comentarios" className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
        <MessageCircle className="size-5 text-bandeira-500" aria-hidden /> Comentários
      </h2>
      {!!comments.length && (
        <ul className="mb-4 space-y-3">
          {comments.map((c) => {
            const mine = c.author_id === meId;
            const name = c.author?.full_name ?? "Usuário";
            return (
              <li key={c.id} className={cn("flex items-start gap-2", mine && "flex-row-reverse")}>
                <Avatar path={c.author?.avatar_path} name={name} size={32} />
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    mine ? "bg-bandeira-500 text-white" : "border border-border bg-surface",
                  )}
                >
                  <p className={cn("mb-0.5 text-xs font-semibold", mine ? "text-white/80" : "text-muted")}>
                    {mine ? "Você" : name.split(" ")[0]} · {formatDateTime(c.created_at)}
                  </p>
                  <p className="whitespace-pre-line break-words">{c.body}</p>
                  {mine && (
                    <form action={deleteSessionComment} className="mt-1 text-right">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="session_id" value={sessionId} />
                      <ConfirmSubmit
                        message="Apagar este comentário?"
                        className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white"
                      >
                        <Trash2 className="size-3" aria-hidden /> Apagar
                      </ConfirmSubmit>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <CommentForm sessionId={sessionId} placeholder={placeholder} />
    </section>
  );
}
