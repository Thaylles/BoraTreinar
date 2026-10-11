import { Target } from "lucide-react";
import { setWeeklyGoal } from "@/app/aluno/meta-actions";
import { createClient } from "@/lib/supabase/server";
import { spDateKey, startOfWeekSP } from "@/lib/week";
import { cn } from "@/lib/cn";

const DAYS = [1, 2, 3, 4, 5, 6, 7];

function GoalButtons({ current }: { current: number | null }) {
  return (
    <form action={setWeeklyGoal} className="flex flex-wrap gap-2">
      {DAYS.map((n) => (
        <button
          key={n}
          name="goal"
          value={n}
          aria-pressed={current === n}
          aria-label={`${n} ${n === 1 ? "dia" : "dias"} por semana`}
          className={cn(
            "size-10 rounded-full border-2 font-display font-bold transition",
            current === n ? "border-bandeira-500 bg-bandeira-500 text-white" : "border-border hover:border-bandeira-500",
          )}
        >
          {n}
        </button>
      ))}
      {current && (
        <button name="goal" value={0} className="px-2 text-xs font-semibold text-muted hover:text-pitanga-600">
          Remover meta
        </button>
      )}
    </form>
  );
}

/** Meta de dias de treino na semana (seg–dom, fuso SP) com barra de progresso. */
export async function WeeklyGoal({ studentId }: { studentId: string }) {
  const supabase = await createClient();
  const [{ data: settings }, { data: sessions }] = await Promise.all([
    supabase.from("student_settings").select("weekly_goal").eq("student_id", studentId).maybeSingle(),
    supabase.from("workout_sessions").select("started_at").eq("student_id", studentId).gte("started_at", startOfWeekSP()),
  ]);
  const goal = settings?.weekly_goal ?? null;
  const days = new Set((sessions ?? []).map((s) => spDateKey(s.started_at))).size;

  if (!goal) {
    return (
      <section className="mb-6 rounded-3xl border border-border bg-surface p-4">
        <p className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <Target className="size-5 text-bandeira-500" aria-hidden /> Meta da semana
        </p>
        <p className="mb-3 text-sm text-muted">Quantos dias por semana você quer treinar?</p>
        <GoalButtons current={null} />
      </section>
    );
  }

  const pct = Math.min(100, Math.round((days / goal) * 100));
  const done = days >= goal;
  return (
    <section className="mb-6 rounded-3xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg font-bold">
          <Target className="size-5 text-bandeira-500" aria-hidden /> Meta da semana
        </p>
        <p className="font-display text-lg font-extrabold tabular-nums">
          {days}/{goal} <span className="text-sm font-semibold text-muted">{goal === 1 ? "dia" : "dias"}</span>
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-border/60" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={days} aria-label="Progresso da meta semanal">
        <div className={cn("h-full rounded-full transition-all", done ? "bg-ipe-500" : "bg-bandeira-500")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {done ? "Meta batida! 🎉 Mandou bem nesta semana." : `Faltam ${goal - days} ${goal - days === 1 ? "dia" : "dias"} de treino para bater a meta.`}
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-foreground">Alterar meta</summary>
        <div className="mt-2">
          <GoalButtons current={goal} />
        </div>
      </details>
    </section>
  );
}
