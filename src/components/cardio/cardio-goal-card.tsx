import { HeartPulse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { removeCardioGoal } from "@/app/cardio-actions";
import { formatAmount, goalLabel, goalProgress, parseCardioWeek } from "@/lib/cardio";
import { cn } from "@/lib/cn";
import { CardioGoalForm } from "./cardio-goal-form";

/**
 * Meta semanal de cardio (seg–dom, fuso SP) com barra de progresso.
 * `canEdit`: Personal vinculado, ou o próprio aluno quando não tem Personal.
 */
export async function CardioGoalCard({ studentId, canEdit, audience }: { studentId: string; canEdit: boolean; audience: "aluno" | "personal" }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("cardio_week", { p_student: studentId });
  if (!data) return null;
  const week = parseCardioWeek(data);
  const progress = goalProgress(week);
  const you = audience === "aluno";

  const summary = (
    <p className="mt-2 text-xs text-muted">
      Nesta semana: {formatAmount(week.minutes, "min")} · {formatAmount(week.km, "km")} · {week.days}{" "}
      {week.days === 1 ? "dia" : "dias"} com cardio
    </p>
  );

  if (!week.goal || !progress) {
    if (!canEdit && !week.minutes) return null;
    return (
      <section className="mb-6 rounded-3xl border border-border bg-surface p-4">
        <p className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <HeartPulse className="size-5 text-pitanga-500" aria-hidden /> Meta de cardio
        </p>
        <p className="mb-3 text-sm text-muted">
          {canEdit
            ? you
              ? "Defina quanto cardio você quer fazer por semana: tempo, distância ou minutos em ritmo forte."
              : "Defina a meta de cardio do aluno: tempo, distância ou minutos em ritmo forte por semana."
            : "Seu Personal ainda não definiu uma meta de cardio."}
        </p>
        {canEdit && <CardioGoalForm studentId={studentId} goal={null} />}
        {summary}
      </section>
    );
  }

  const left = Math.max(0, progress.target - progress.value);
  return (
    <section className="mb-6 rounded-3xl border border-border bg-surface p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <HeartPulse className="size-5 text-pitanga-500" aria-hidden /> Meta de cardio
        </p>
        <p className="font-display text-lg font-extrabold tabular-nums">
          {formatAmount(progress.value, progress.unit)}
          <span className="text-sm font-semibold text-muted"> / {formatAmount(progress.target, progress.unit)}</span>
        </p>
      </div>
      <p className="mb-2 text-xs text-muted">
        {goalLabel(week.goal)}
        {week.goal.by_personal && you && " · definida pelo seu Personal"}
      </p>
      <div
        className="h-3 overflow-hidden rounded-full bg-border/60"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.target}
        aria-valuenow={progress.value}
        aria-label="Progresso da meta de cardio"
      >
        <div className={cn("h-full rounded-full transition-all", progress.done ? "bg-ipe-500" : "bg-pitanga-500")} style={{ width: `${progress.pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {progress.done
          ? "Meta de cardio batida! 🫀🔥"
          : `Faltam ${formatAmount(left, progress.unit)}${week.goal.kind === "intenso" ? " em ritmo forte" : ""} para bater a meta.`}
      </p>
      {summary}
      {canEdit && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-foreground">Alterar meta de cardio</summary>
          <div className="mt-3 space-y-2">
            <CardioGoalForm studentId={studentId} goal={week.goal} />
            <form action={removeCardioGoal}>
              <input type="hidden" name="student_id" value={studentId} />
              <button className="text-xs font-semibold text-muted hover:text-pitanga-600">Remover meta de cardio</button>
            </form>
          </div>
        </details>
      )}
    </section>
  );
}
