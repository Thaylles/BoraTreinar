"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Play, Plus, Save, Trash2 } from "lucide-react";
import { ExercisePicker, type CatalogItem } from "@/components/plans/exercise-picker";
import { Button } from "@/components/ui/button";
import { equipmentImageSrc, groupLabel } from "@/lib/catalog";
import { draftStore } from "@/lib/outbox";
import { saveFreeAsPlan } from "@/app/aluno/fichas/actions";
import { inputClass } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const KEY = "bt:livre:ultimo";

/** Monta o treino livre do dia escolhendo apenas exercícios do catálogo. */
export function FreeBuilder({
  catalog,
  max,
  canSave = false,
  extraQuery = "",
}: {
  catalog: CatalogItem[];
  max: number;
  canSave?: boolean;
  /** Treino esquecido: "passado=…&min=…" segue para a tela do treino. */
  extraQuery?: string;
}) {
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
    router.push(`/aluno/livre/treinar?e=${ids.join(",")}${extraQuery ? `&${extraQuery}` : ""}`);
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

      {canSave && ids.length > 0 && <SaveAsPlan ids={ids} />}

      <div className="sticky bottom-4 z-10">
        <Button size="lg" className="w-full shadow-xl" disabled={!ids.length} onClick={start}>
          <Play className="size-5" aria-hidden /> Começar treino livre
        </Button>
      </div>

      {picking && (
        <ExercisePicker catalog={catalog} selectedIds={ids} onPick={toggle} onClose={() => setPicking(false)} allowRequest={canSave} />
      )}
    </div>
  );
}

/** Opcional: guardar a seleção do dia como ficha para repetir depois (o treino de hoje não muda). */
function SaveAsPlan({ ids }: { ids: string[] }) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (saved) {
    return (
      <Alert kind="success">
        Ficha salva! Ela aparece em &quot;Suas fichas&quot; na tela inicial.{" "}
        <Link href={`/aluno/fichas/${saved}`} className="font-semibold underline">
          Ver ficha
        </Link>
      </Alert>
    );
  }
  return (
    <details className="rounded-3xl border border-border bg-surface p-4">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold">
        <Save className="size-4 text-bandeira-600" aria-hidden /> Salvar como ficha <span className="text-sm font-normal text-muted">(opcional)</span>
      </summary>
      <p className="mt-2 text-sm text-muted">Vai repetir este treino outras vezes? Salve como ficha. Se for só hoje, não precisa.</p>
      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Nome da ficha (ex.: Treino A)"
          aria-label="Nome da ficha"
          className={inputClass}
        />
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await saveFreeAsPlan(name, ids);
              if (res.error) setError(res.error);
              else if (res.id) setSaved(res.id);
            })
          }
          className="flex shrink-0 items-center gap-1 rounded-2xl bg-anil-700 px-4 font-semibold text-white disabled:opacity-50 dark:bg-ipe-500 dark:text-anil-900"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />} Salvar
        </button>
      </div>
      {error && (
        <Alert className="mt-2">
          {error}
        </Alert>
      )}
    </details>
  );
}
