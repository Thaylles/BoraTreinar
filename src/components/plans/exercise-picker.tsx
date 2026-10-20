"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, MessageSquarePlus, Search, X } from "lucide-react";
import { requestExercise } from "@/app/aluno/fichas/actions";
import { FormMessage } from "@/components/ui/alert";
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
  cautions = {},
  allowRequest = false,
}: {
  catalog: CatalogItem[];
  selectedIds: string[];
  onPick: (item: CatalogItem) => void;
  onClose: () => void;
  multiple?: boolean;
  /** Anamnese do aluno: motivos de cuidado por grupo muscular. */
  cautions?: Record<string, string[]>;
  /** Aluno: "Não encontrou o exercício?" envia um pedido para Personais e admins. */
  allowRequest?: boolean;
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
                    {cautions[c.muscle_group] && (
                      <span className="block text-xs font-semibold text-pitanga-600">⚠️ {cautions[c.muscle_group].join(", ")}</span>
                    )}
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
          {allowRequest && (
            <li className="p-2">
              <RequestExercise key={q} initialName={filtered.length ? "" : q.trim()} highlight={!filtered.length} />
            </li>
          )}
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

/** "Não encontrou o exercício?": o aluno escreve o nome e Personais/admins adicionam ao catálogo. */
function RequestExercise({ initialName, highlight }: { initialName: string; highlight: boolean }) {
  const [open, setOpen] = useState(highlight);
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ error?: string; ok?: string }>();
  const [pending, startTransition] = useTransition();

  if (state?.ok) return <FormMessage state={state} />;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-3 text-sm font-semibold text-muted hover:border-bandeira-500 hover:text-foreground"
      >
        <MessageSquarePlus className="size-4" aria-hidden /> Não encontrou o exercício?
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border-2 border-ipe-500 bg-ipe-100/50 p-3 text-sm dark:bg-ipe-500/10">
      <p className="font-display text-base font-bold">Não encontrou o exercício?</p>
      <p className="text-muted">Escreva o nome do exercício ou da máquina para que os administradores possam adicionar ao catálogo.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="Ex.: Remada cavalinho na máquina"
        aria-label="Nome do exercício ou máquina"
        className={cn(inputClass, "py-2")}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Detalhe opcional (como é a máquina, para que serve…)"
        aria-label="Detalhe opcional"
        className={cn(inputClass, "py-2 text-sm")}
      />
      <FormMessage state={state} />
      <button
        type="button"
        disabled={pending || name.trim().length < 2}
        onClick={() => startTransition(async () => setState(await requestExercise(name, note)))}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-anil-700 py-2.5 font-semibold text-white disabled:opacity-50 dark:bg-ipe-500 dark:text-anil-900"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Enviar pedido
      </button>
    </div>
  );
}
