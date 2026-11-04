import { Copy, Dumbbell } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { adoptStarter } from "@/app/treinos-prontos-actions";
import { LEVELS, type StarterWorkout } from "@/lib/starter";

const repsLabel = (min: number | null, max: number | null) => (min && max && min !== max ? `${min}–${max}` : String(min ?? max ?? "—"));

const TECHNIQUE: Record<string, string> = {
  dropset: "drop-set",
  restpause: "rest-pause",
  piramide: "pirâmide",
  biset: "bi-set",
  triset: "tri-set",
  cluster: "cluster",
};

/** Os treinos prontos por nível, com o botão para copiar os 4 de uma vez. */
export function StarterCatalog({ workouts, asTemplates, error }: { workouts: StarterWorkout[]; asTemplates: boolean; error?: string }) {
  return (
    <>
      {error && <Alert className="mb-4">{error}</Alert>}
      <div className="space-y-8">
        {LEVELS.map((lvl) => {
          const list = workouts.filter((w) => w.level === lvl.key);
          if (!list.length) return null;
          return (
            <section key={lvl.key} id={lvl.key} aria-labelledby={`nivel-${lvl.key}`} className="scroll-mt-20">
              <h2 id={`nivel-${lvl.key}`} className="font-display text-2xl font-extrabold">
                <span aria-hidden>{lvl.emoji}</span> {lvl.label}
              </h2>
              <p className="mb-3 text-sm text-muted">{lvl.sub}</p>
              <ul className="mb-3 grid gap-3 sm:grid-cols-2">
                {list.map((w) => (
                  <li key={w.id}>
                    <Card className="h-full">
                      <p className="flex items-center gap-2 font-display font-bold leading-tight">
                        <Dumbbell className="size-5 shrink-0 text-bandeira-500" aria-hidden /> {w.name}
                      </p>
                      {w.goal && <p className="mt-0.5 text-xs text-muted">🎯 {w.goal}</p>}
                      <ol className="mt-2 space-y-0.5 text-sm">
                        {w.items.map((it, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="min-w-0 truncate">{it.equipment?.name ?? "Exercício"}</span>
                            <span className="shrink-0 tabular-nums text-muted">
                              {it.sets}× {repsLabel(it.reps_min, it.reps_max)}
                              {it.technique && ` · ${TECHNIQUE[it.technique] ?? it.technique}`}
                            </span>
                          </li>
                        ))}
                      </ol>
                      {w.notes && <p className="mt-2 text-xs text-muted">{w.notes}</p>}
                    </Card>
                  </li>
                ))}
              </ul>
              <form action={adoptStarter}>
                <input type="hidden" name="level" value={lvl.key} />
                {asTemplates && <input type="hidden" name="as_templates" value="1" />}
                <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-bandeira-500 px-4 py-3 font-display font-bold text-white shadow-md hover:bg-bandeira-600">
                  <Copy className="size-5" aria-hidden />
                  {asTemplates ? `Copiar os 4 treinos ${lvl.label} para os meus modelos` : `Usar os 4 treinos ${lvl.label}`}
                </button>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}
