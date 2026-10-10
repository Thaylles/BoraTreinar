import Link from "next/link";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { EquipmentImage } from "@/components/equipment-image";
import { groupLabel } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { formatKg } from "@/lib/plans";
import type { loadExerciseTimeline } from "@/lib/sessions-server";
import { LoadChart } from "./load-chart";

type Data = Awaited<ReturnType<typeof loadExerciseTimeline>>;

export function ExerciseHistory({ data, sessionHref }: { data: Data; sessionHref: (id: string) => string }) {
  const { equipment, entries, best } = data;
  if (!equipment) return null;
  const last = entries[entries.length - 1];
  const lastDone = last?.sets.filter((s) => s.done) ?? [];

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <EquipmentImage equipment={equipment} className="size-20 shrink-0 rounded-2xl" />
        <div>
          <h1 className="font-display text-2xl font-extrabold leading-tight">{equipment.name}</h1>
          <Badge tone="green">{groupLabel(equipment.muscle_group)}</Badge>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Última vez{last && ` · ${formatDate(last.date)}`}</p>
          <p className="font-display text-lg font-bold">
            {lastDone.length ? lastDone.map((s) => `${s.load.toLocaleString("pt-BR")}×${s.reps}`).join(" · ") : "—"}
          </p>
        </div>
        <div className="rounded-3xl bg-ipe-500 p-4 text-anil-900">
          <p className="flex items-center gap-1 text-xs font-semibold">
            <Trophy className="size-3.5" aria-hidden /> Recorde pessoal
          </p>
          <p className="font-display text-2xl font-extrabold">{best > 0 ? formatKg(best) : "—"}</p>
        </div>
      </div>

      <section className="mb-6 rounded-3xl border border-border bg-surface p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Maior carga por treino</h2>
        <LoadChart points={entries.map((e) => ({ date: e.date, maxLoad: e.maxLoad, pr: e.pr }))} />
      </section>

      <h2 className="mb-2 font-display text-lg font-bold">Histórico completo</h2>
      {!entries.length ? (
        <p className="text-sm text-muted">Ainda não há registros deste exercício.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-semibold">Data</th>
              <th className="py-1 font-semibold">Séries feitas</th>
              <th className="py-1 text-right font-semibold">Maior</th>
            </tr>
          </thead>
          <tbody>
            {[...entries].reverse().map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="py-2 align-top">
                  <Link href={sessionHref(e.id)} className="hover:underline">
                    {formatDate(e.date)}
                  </Link>
                </td>
                <td className="py-2 align-top">
                  {e.sets.filter((s) => s.done).map((s) => `${s.load.toLocaleString("pt-BR")}×${s.reps}`).join(", ") || "—"}
                </td>
                <td className="py-2 text-right align-top font-semibold">
                  {e.maxLoad.toLocaleString("pt-BR")} kg {e.pr && <Trophy className="inline size-3.5 text-ipe-600" aria-label="recorde" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
