import Link from "next/link";
import { Check, Clock, Trophy, UserCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { EquipmentImage } from "@/components/equipment-image";
import { formatDateTime } from "@/lib/format";
import type { loadSession } from "@/lib/sessions-server";
import { effortInfo } from "@/lib/effort";

type Loaded = NonNullable<Awaited<ReturnType<typeof loadSession>>>;

const dur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` : `${Math.round(s / 60)} min`);

export function SessionDetail({ data, exerciseHref }: { data: Loaded; exerciseHref: (equipmentId: string) => string }) {
  const { session, exercises } = data;
  const allSets = exercises.flatMap((e) => e.sets);
  const done = allSets.filter((s) => s.done);
  const volume = done.reduce((acc, s) => acc + Number(s.load_kg) * s.reps, 0);
  const byInstructor = session.logged_by && session.logged_by !== session.student_id;

  return (
    <>
      <div className="mb-4">
        <div className="mb-1 flex flex-wrap gap-2">
          {session.kind === "livre" ? <Badge tone="blue">Treino livre</Badge> : <Badge tone="green">Ficha</Badge>}
          {byInstructor && (
            <Badge tone="yellow">
              <UserCheck className="mr-1 size-3" aria-hidden /> Registrado pelo instrutor
            </Badge>
          )}
          {done.some((s) => s.is_pr) && (
            <Badge tone="yellow">
              <Trophy className="mr-1 size-3" aria-hidden /> Recorde
            </Badge>
          )}
        </div>
        <h1 className="font-display text-3xl font-extrabold leading-tight">{session.plan_name ?? "Treino livre"}</h1>
        <p className="text-sm text-muted">
          {formatDateTime(session.started_at)} · <Clock className="inline size-3.5" aria-hidden /> {dur(session.duration_seconds)}
          {byInstructor && session.logger && ` · por ${session.logger.full_name}`}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Exercícios", value: exercises.length },
          { label: "Séries feitas", value: `${done.length}/${allSets.length}` },
          { label: "Volume", value: `${Math.round(volume).toLocaleString("pt-BR")} kg` },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl border border-border bg-surface p-3">
            <p className="font-display text-xl font-extrabold">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {session.effort != null && (
        <div className={`mb-6 rounded-3xl border p-4 ${session.pain ? "border-pitanga-500/60 bg-pitanga-100/50 dark:bg-pitanga-500/10" : "border-border bg-surface"}`}>
          <p className="font-semibold">
            {effortInfo(session.effort)?.emoji} Esforço: {effortInfo(session.effort)?.label} ({session.effort}/5)
          </p>
          {session.pain && <p className="mt-1 text-sm font-semibold text-pitanga-600">⚠️ Relatou dor ou desconforto</p>}
          {session.feedback && <p className="mt-1 text-sm">💬 “{session.feedback}”</p>}
        </div>
      )}

      <ol className="space-y-3">
        {exercises.map((ex) => (
          <li key={ex.order} className="rounded-3xl border border-border bg-surface p-3">
            <div className="flex items-center gap-3">
              {ex.equipment && <EquipmentImage equipment={ex.equipment} className="size-14 shrink-0 rounded-xl" />}
              <Link href={exerciseHref(ex.equipmentId)} className="font-semibold hover:underline">
                {ex.equipment?.name ?? "Exercício indisponível"}
              </Link>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {ex.sets.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="w-5 text-muted">{s.set_number}.</span>
                  {s.done ? <Check className="size-4 text-bandeira-600" aria-label="feita" /> : <X className="size-4 text-pitanga-500" aria-label="não feita" />}
                  <span className={s.done ? "" : "text-muted line-through"}>
                    {Number(s.load_kg).toLocaleString("pt-BR")} kg × {s.reps}
                  </span>
                  {s.is_pr && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-ipe-500 px-2 text-xs font-bold text-anil-900">
                      <Trophy className="size-3" aria-hidden /> PR
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
}
