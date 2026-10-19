"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { MUSCLE_GROUPS, equipmentImageSrc, groupLabel, type MuscleGroup } from "@/lib/catalog";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export type CatalogItem = {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  image_path: string | null;
  image_url: string | null;
  is_bodyweight: boolean;
  /** Cardio: como o painel do aparelho mede a intensidade. */
  intensity_unit?: "velocidade" | "nivel" | null;
};

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Modal (tela cheia no celular) para escolher exercícios do catálogo. */
export function ExercisePicker({
  catalog,
  selectedIds,
  onPick,
  onClose,
  multiple = true,
}: {
  catalog: CatalogItem[];
  selectedIds: string[];
  onPick: (item: CatalogItem) => void;
  onClose: () => void;
  multiple?: boolean;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const groups = useMemo(
    () => MUSCLE_GROUPS.filter((g) => catalog.some((c) => c.muscle_group === g.value)),
    [catalog],
  );
  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return catalog.filter(
      (c) => (!group || c.muscle_group === group) && (!nq || normalize(c.name).includes(nq)),
    );
  }, [catalog, q, group]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Escolher exercício"
      className="m-0 h-dvh max-h-none w-full max-w-none bg-background p-0 text-foreground backdrop:bg-black/40 sm:m-auto sm:h-[85vh] sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex h-full flex-col">
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Escolher exercício</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-full p-2 hover:bg-border/50"
              aria-label="Fechar"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar no catálogo…"
              aria-label="Buscar no catálogo"
              className={cn(inputClass, "pl-12")}
            />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={!group} onClick={() => setGroup(null)}>
              Todos
            </Chip>
            {groups.map((g) => (
              <Chip key={g.value} active={group === g.value} onClick={() => setGroup(group === g.value ? null : g.value)}>
                {g.label}
              </Chip>
            ))}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto p-2">
          {filtered.map((c) => {
            const src = equipmentImageSrc(c);
            const selected = selectedIds.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(c);
                    if (!multiple) dialogRef.current?.close();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura
                    <img src={src} alt="" className="size-14 shrink-0 rounded-xl bg-ipe-100 object-cover" loading="lazy" />
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-anil-700/5 text-[10px] font-semibold text-muted">
                      {groupLabel(c.muscle_group)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">{c.name}</span>
                    <span className="text-xs text-muted">{groupLabel(c.muscle_group)}</span>
                  </span>
                  {selected && (
                    <span className="rounded-full bg-bandeira-500 p-1 text-white" aria-label="Já na ficha">
                      <Check className="size-4" aria-hidden />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {!filtered.length && <li className="p-6 text-center text-sm text-muted">Nada encontrado.</li>}
        </ul>

        {multiple && (
          <div className="border-t border-border p-4">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="w-full rounded-2xl bg-bandeira-500 py-3 font-display font-bold text-white"
            >
              Pronto
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold",
        active ? "bg-anil-700 text-white dark:bg-ipe-500 dark:text-anil-900" : "border border-border bg-surface text-muted",
      )}
    >
      {children}
    </button>
  );
}
