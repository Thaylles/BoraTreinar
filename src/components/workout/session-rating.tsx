"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { rateSession } from "@/app/treino-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { EFFORT } from "@/lib/effort";
import { cn } from "@/lib/cn";

/** "Como foi o treino?": esforço 1–5, dor/desconforto e comentário para o Personal. */
export function SessionRating({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial?: { effort: number | null; pain: boolean; feedback: string | null };
}) {
  const [effort, setEffort] = useState<number | null>(initial?.effort ?? null);
  const [pain, setPain] = useState(initial?.pain ?? false);
  const [feedback, setFeedback] = useState(initial?.feedback ?? "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <Alert kind="success" className="text-left">
        Avaliação enviada. Obrigado! {pain && "Seu Personal foi avisado sobre a dor."}
      </Alert>
    );
  }

  return (
    <form
      className="space-y-3 rounded-3xl border border-border bg-surface p-4 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        if (!effort) return setError("Escolha uma nota de esforço.");
        setError(null);
        startTransition(async () => {
          const res = await rateSession({ sessionId, effort, pain, feedback });
          if (res.error) setError(res.error);
          else setSent(true);
        });
      }}
    >
      <p className="font-display text-lg font-bold">Como foi o treino?</p>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Esforço do treino">
        {EFFORT.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={effort === o.value}
            onClick={() => setEffort(o.value)}
            className={cn(
              "flex flex-col items-center rounded-2xl border-2 px-1 py-2 text-xs font-semibold transition",
              effort === o.value ? "border-bandeira-500 bg-bandeira-50 dark:bg-bandeira-500/15" : "border-border hover:border-bandeira-500/50",
            )}
          >
            <span className="text-2xl" aria-hidden>
              {o.emoji}
            </span>
            {o.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={pain} onChange={(e) => setPain(e.target.checked)} className="size-5 accent-pitanga-500" />
        Senti dor ou desconforto
      </label>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={pain ? "Onde doeu? Em qual exercício?" : "Comentário para o Personal (opcional)"}
        aria-label="Comentário sobre o treino"
        className={inputClass}
      />
      {error && <Alert>{error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Enviar avaliação
      </Button>
    </form>
  );
}
