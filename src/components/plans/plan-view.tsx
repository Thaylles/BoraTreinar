import { Repeat, Timer, Weight } from "lucide-react";
import { EquipmentImage } from "@/components/equipment-image";
import { groupLabel } from "@/lib/catalog";
import { formatKg, formatReps, formatRest, groupedWithNext, techniqueInfo } from "@/lib/plans";
import type { LoadedPlan } from "@/lib/plans-server";

/** Lista de exercícios da ficha (somente leitura), usada pelo Personal e pelo Aluno. */
export function PlanItemsList({ items }: { items: LoadedPlan["items"] }) {
  const grouped = groupedWithNext(items.map((i) => i.technique));
  return (
    <ol className="space-y-3">
      {items.map((it, idx) => (
        <li key={it.id} className="flex gap-3 rounded-3xl border border-border bg-surface p-3">
          <div className="w-24 shrink-0 sm:w-32">
            {it.equipment ? (
              <EquipmentImage equipment={it.equipment} className="rounded-xl" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-border/40 text-xs text-muted">?</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">
              <span className="mr-1 text-bandeira-600 dark:text-bandeira-100">{idx + 1}.</span>
              {it.equipment?.name ?? "Exercício indisponível"}
            </p>
            {it.equipment && <p className="text-xs text-muted">{groupLabel(it.equipment.muscle_group)}</p>}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3.5 text-muted" aria-hidden />
                {it.sets} × {formatReps(it.reps_min, it.reps_max) || "—"}
                {it.equipment?.muscle_group === "cardio" && " min"}
              </span>
              {it.suggested_load != null && (
                <span className="inline-flex items-center gap-1">
                  <Weight className="size-3.5 text-muted" aria-hidden />
                  {formatKg(it.suggested_load)}
                </span>
              )}
              {it.rest_seconds > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Timer className="size-3.5 text-muted" aria-hidden />
                  {formatRest(it.rest_seconds)}
                </span>
              )}
            </div>
            {it.technique && (
              <p className="mt-1.5 text-sm">
                <span className="mr-1 rounded-full bg-ipe-100 px-2 py-0.5 text-xs font-bold text-anil-700 dark:bg-ipe-500/20 dark:text-ipe-400">
                  {techniqueInfo(it.technique)?.label}
                </span>
                <span className="text-xs text-muted">{techniqueInfo(it.technique)?.hint}</span>
              </p>
            )}
            {grouped[idx] > 0 && !it.technique && (
              <p className="mt-1.5 text-xs font-semibold text-anil-700 dark:text-ipe-400">↳ continua no próximo exercício, sem descanso</p>
            )}
            {it.notes && <p className="mt-1 text-sm text-muted">💬 {it.notes}</p>}
            {it.substitute && <p className="mt-1 text-xs text-muted">🔁 Se o aparelho estiver ocupado: {it.substitute.name}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
