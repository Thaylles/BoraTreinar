"use client";

import { useState, useTransition } from "react";
import { Droplets, Loader2, Settings2, Undo2 } from "lucide-react";
import { addWater, removeWater, saveWaterGoal } from "@/app/agua-actions";
import { inputClass } from "@/components/ui/field";
import { BOTTLES, bottleLabel, liters } from "@/lib/water";
import type { WaterToday } from "@/lib/water-server";
import { cn } from "@/lib/cn";

/** Meta de água do dia: progresso, garrafas com um toque, desfazer e definir a meta. */
export function WaterCard({ initial, suggestion }: { initial: WaterToday; suggestion: number }) {
  const [water, setWater] = useState(initial);
  const [editing, setEditing] = useState(initial.goalMl === null);
  const [goal, setGoal] = useState(((initial.goalMl ?? suggestion) / 1000).toLocaleString("pt-BR"));
  const [reminders, setReminders] = useState(initial.reminders);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true; water: WaterToday } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.error);
      setWater(res.water);
      after?.();
    });

  const pct = water.goalMl ? Math.min(100, Math.round((water.totalMl / water.goalMl) * 100)) : 0;
  const reached = !!water.goalMl && water.totalMl >= water.goalMl;

  return (
    <section id="agua" aria-label="Meta de água" className="mb-4 scroll-mt-20 rounded-3xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Droplets className="size-5 text-anil-500" aria-hidden /> Água de hoje
        </h2>
        {water.goalMl !== null && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold text-muted hover:bg-border/50"
            aria-expanded={editing}
          >
            <Settings2 className="size-4" aria-hidden /> Meta
          </button>
        )}
      </div>

      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => saveWaterGoal(goal, reminders),
              () => setEditing(false),
            );
          }}
        >
          <p className="text-sm text-muted">
            Quantos litros por dia você quer beber? Sugestão: {liters(suggestion)} (cerca de 35 ml por kg).
          </p>
          <label className="flex items-center gap-2">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              inputMode="decimal"
              className={cn(inputClass, "w-28 text-center text-lg font-bold")}
              aria-label="Meta diária em litros"
            />
            <span className="font-semibold">litros por dia</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reminders}
              onChange={(e) => setReminders(e.target.checked)}
              className="size-4 accent-bandeira-500"
            />
            Me lembrar de 3 em 3 horas (8h às 20h) enquanto não bater a meta
          </label>
          <button
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-2xl bg-anil-700 px-4 py-2.5 font-display font-bold text-white disabled:opacity-60 dark:bg-ipe-500 dark:text-anil-900"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar meta
          </button>
        </form>
      ) : (
        <>
          <p className="mb-1 text-sm">
            <span className="font-display text-2xl font-extrabold tabular-nums">{liters(water.totalMl)}</span>
            <span className="text-muted"> de {liters(water.goalMl ?? 0)}</span>
            {reached && <span className="ml-2 font-semibold text-bandeira-600 dark:text-bandeira-100">Meta batida! 🎉</span>}
          </p>
          <div
            className="mb-3 h-3 overflow-hidden rounded-full bg-border/60"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da meta de água"
          >
            <div className="h-full rounded-full bg-anil-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <WaterButtons disabled={pending} onAdd={(ml) => run(() => addWater(ml))} />
          {water.lastId && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => removeWater(water.lastId!))}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground"
            >
              <Undo2 className="size-3.5" aria-hidden /> Desfazer último ({bottleLabel(water.lastMl ?? 0)})
            </button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-pitanga-600">
          {error}
        </p>
      )}
    </section>
  );
}

/** As 4 garrafas (500 ml, 1 L, 1,5 L, 2 L). */
export function WaterButtons({ onAdd, disabled }: { onAdd: (ml: number) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {BOTTLES.map((ml) => (
        <button
          key={ml}
          type="button"
          disabled={disabled}
          onClick={() => onAdd(ml)}
          className="flex flex-col items-center rounded-2xl border-2 border-anil-500/30 bg-anil-500/5 py-2 font-display font-bold transition hover:border-anil-500 disabled:opacity-60"
          aria-label={`Bebi ${bottleLabel(ml)}`}
        >
          <span aria-hidden>💧</span>+{bottleLabel(ml)}
        </button>
      ))}
    </div>
  );
}
