"use client";

import { useActionState } from "react";
import { addSessionComment } from "@/app/treino-actions";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClass } from "@/components/ui/field";

export function CommentForm({ sessionId, placeholder }: { sessionId: string; placeholder: string }) {
  const [state, action] = useActionState(addSessionComment, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="session_id" value={sessionId} />
      <label htmlFor="comment-body" className="sr-only">
        Comentário
      </label>
      <textarea id="comment-body" name="body" required maxLength={1000} rows={3} placeholder={placeholder} className={inputClass} />
      {state?.error && <FormMessage state={state} />}
      <SubmitButton pendingText="Enviando…">Comentar</SubmitButton>
    </form>
  );
}
