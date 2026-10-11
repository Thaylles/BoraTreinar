"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Play, Plus, Trash2 } from "lucide-react";
import { ExercisePicker, type CatalogItem } from "@/components/plans/exercise-picker";
import { Button } from "@/components/ui/button";
import { equipmentImageSrc, groupLabel } from "@/lib/catalog";
import { draftStore } from "@/lib/outbox";

const KEY = "bt:livre:ultimo";

/** Monta o treino livre do dia escolhendo apenas exercícios do catálogo. */
export function FreeBuilder({ catalog, max }: { catalog: CatalogItem[]; max: number }) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const items = ids.map((id) => byId.get(id)).filter((c): c is CatalogItem => !!c);

  // Sugere a última seleção (só o que ainda está no catálogo).
  useEffect(() => {
    const last = draftStore.get<string[]>(KEY);
    if (last?.length) setIds(last.filter((id) => catalog.some((c) => c.id === id)));
  }, [catalog]);

  const move = (i: number, d: number) =>
    setIds((l) => {
      const n = [...l];
      const [x] = n.splice(i, 1);
      n.splice(i + d, 0, x);
      return n;
    });

  function toggle(c: CatalogItem) {
    setIds((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : l.length >= max ? l : [...l, c.id]));
  }

  function start() {
    draftStore.set(KEY, ids);
    router.push(`/aluno/livre/treinar?e=${ids.join(",")}`);
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border p-6 text-center text-sm text-muted">
          Escolha os exercícios que você vai fazer hoje. Só dá para usar exercícios do catálogo.
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((c, i) => {
            const src = equipmentImageSrc(c);
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-2">
                <span className="w-5 text-center font-display font-bold text-bandeira-600 dark:text-bandeira-100">{i + 1}</span>
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura
                  <img src={src} alt="" className="size-12 shrink-0 rounded-xl bg-ipe-100 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">{groupLabel(c.muscle_group)}</p>
                </div>
                <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg p-2 text-muted disabled:opacity-30">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" aria-label="Descer" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="rounded-lg p-2 text-muted disabled:opacity-30">
                  <ArrowDown className="size-4" />
                </button>
                <button type="button" aria-label="Remover" onClick={() => setIds((l) => l.filter((x) => x !== c.id))} className="rounded-lg p-2 text-pitanga-600">
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={() => setPicking(true)}
        disabled={ids.length >= max}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-bandeira-500/50 py-4 font-display font-bold text-bandeira-600 hover:bg-bandeira-50 disabled:opacity-40 dark:text-bandeira-100 dark:hover:bg-bandeira-500/10"
      >
        <Plus className="size-5" aria-hidden /> {ids.length ? "Adicionar mais exercícios" : "Escolher exercícios"}
      </button>
      {ids.length >= max && <p className="text-center text-xs text-muted">Máximo de {max} exercícios por treino.</p>}

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <Button size="lg" className="w-full shadow-xl" disabled={!ids.length} onClick={start}>
          <Play className="size-5" aria-hidden /> Começar treino livre
        </Button>
      </div>

      {picking && (
        <ExercisePicker catalog={catalog} selectedIds={ids} onPick={toggle} onClose={() => setPicking(false)} />
      )}
    </div>
  );
}
