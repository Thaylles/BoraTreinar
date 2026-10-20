"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { equipmentImageSrc, groupLabel } from "@/lib/catalog";
import { parseReps, REST_OPTIONS, TECHNIQUES, formatRest, techniqueInfo, type Technique } from "@/lib/plans";
import { savePlan, type PlanPayload } from "@/app/personal/fichas/actions";
import { saveMyPlan } from "@/app/aluno/fichas/actions";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ExercisePicker, type CatalogItem } from "./exercise-picker";
import { cn } from "@/lib/cn";

export type EditorItem = {
  key: string;
  equipment: CatalogItem;
  sets: number;
  reps: string;
  load: string;
  rest: number;
  notes: string;
  technique: Technique | "";
  /** Substituto indicado para quando o aparelho estiver ocupado. */
  substitute: CatalogItem | null;
};

export type EditorInitial = {
  planId: string | null;
  studentId: string | null;
  name: string;
  goal: string;
  notes: string;
  validUntil: string;
  items: Omit<EditorItem, "key">[];
};

let keySeq = 0;
const newKey = () => `i${++keySeq}`;

const parseKg = (s: string): number | null | undefined => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 9999 ? n : undefined;
};

export function PlanEditor({
  initial,
  catalog,
  cautions = {},
  mode = "personal",
}: {
  initial: EditorInitial;
  catalog: CatalogItem[];
  /** "aluno": ficha montada pelo próprio aluno (sem validade nem substituto; pode pedir exercício). */
  mode?: "personal" | "aluno";
  /** Anamnese do aluno: motivos de cuidado por grupo muscular (ex.: quadríceps → dor no joelho). */
  cautions?: Record<string, string[]>;
}) {
  const [name, setName] = useState(initial.name);
  const [goal, setGoal] = useState(initial.goal);
  const [notes, setNotes] = useState(initial.notes);
  const [validUntil, setValidUntil] = useState(initial.validUntil);
  const [items, setItems] = useState<EditorItem[]>(() => initial.items.map((i) => ({ ...i, key: newKey() })));
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: string, patch: Partial<EditorItem>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list];
      const [it] = next.splice(index, 1);
      next.splice(index + delta, 0, it);
      return next;
    });

  function addFromCatalog(c: CatalogItem) {
    setItems((list) => [
      ...list,
      { key: newKey(), equipment: c, sets: 3, reps: c.muscle_group === "cardio" ? "20" : "10–12", load: "", rest: c.muscle_group === "cardio" ? 0 : 60, notes: "", technique: "", substitute: null },
    ]);
  }

  function save() {
    setError(null);
    const payloadItems: PlanPayload["items"] = [];
    for (const [idx, it] of items.entries()) {
      const reps = parseReps(it.reps);
      if (!reps) return setError(`Repetições inválidas no exercício ${idx + 1}. Use "12" ou "10-12".`);
      const load = parseKg(it.load);
      if (load === undefined) return setError(`Carga inválida no exercício ${idx + 1}.`);
      payloadItems.push({
        equipment_id: it.equipment.id,
        sets: it.sets,
        ...reps,
        suggested_load: load,
        rest_seconds: it.rest,
        notes: it.notes,
        technique: it.technique || null,
        substitute_equipment_id: it.substitute?.id ?? null,
      });
    }
    startTransition(async () => {
      const res =
        mode === "aluno"
          ? await saveMyPlan({ planId: initial.planId, name, goal, notes, items: payloadItems })
          : await savePlan({
              planId: initial.planId,
              studentId: initial.studentId,
              name,
              goal,
              notes,
              validUntil,
              items: payloadItems,
            });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-3xl border border-border bg-surface p-5">
        <Field id="plan-name" label="Nome da ficha" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Treino A — Peito e tríceps" required />
        <Field id="plan-goal" label="Objetivo" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={200} placeholder="Ex.: Hipertrofia, resistência…" />
        <div className="space-y-1.5">
          <label htmlFor="plan-notes" className="block text-sm font-semibold">
            Observações gerais
          </label>
          <textarea id="plan-notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Aquecimento, cadência, cuidados…" />
        </div>
        {mode === "personal" && initial.studentId !== null ? (
          <Field label="Válida até (opcional)" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Exercícios ({items.length})</h2>
        {Object.keys(cautions).length > 0 && (
          <div className="rounded-2xl bg-ipe-100 p-3 text-sm text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400">
            <p className="font-bold">🩺 Pela anamnese, cuidado com:</p>
            <ul className="mt-1 space-y-0.5">
              {Object.entries(cautions).map(([g, reasons]) => (
                <li key={g}>
                  <strong>{groupLabel(g as CatalogItem["muscle_group"])}</strong>: {reasons.join(", ")}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Prefira menos volume, variações sem dor e boa amplitude controlada nesses grupos.</p>
          </div>
        )}
        {items.map((it, idx) => {
          const src = equipmentImageSrc(it.equipment);
          return (
            <article key={it.key} className="rounded-3xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-anil-700 text-sm font-bold text-white dark:bg-ipe-500 dark:text-anil-900">
                  {idx + 1}
                </span>
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura
                  <img src={src} alt="" className="size-12 shrink-0 rounded-xl bg-ipe-100 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{it.equipment.name}</p>
                  <p className="text-xs text-muted">{groupLabel(it.equipment.muscle_group)}</p>
                  {cautions[it.equipment.muscle_group] && (
                    <p className="text-xs font-semibold text-pitanga-600">⚠️ Atenção: {cautions[it.equipment.muscle_group].join(", ")}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconBtn label="Subir" disabled={idx === 0} onClick={() => move(idx, -1)}>
                    <ArrowUp className="size-4" />
                  </IconBtn>
                  <IconBtn label="Descer" disabled={idx === items.length - 1} onClick={() => move(idx, 1)}>
                    <ArrowDown className="size-4" />
                  </IconBtn>
                  <IconBtn label="Remover" danger onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>
                    <Trash2 className="size-4" />
                  </IconBtn>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <span className="mb-1 block text-xs font-semibold text-muted">Séries</span>
                  <div className="flex items-center rounded-2xl border border-border">
                    <IconBtn label="Menos uma série" onClick={() => update(it.key, { sets: Math.max(1, it.sets - 1) })}>
                      <Minus className="size-4" />
                    </IconBtn>
                    <span className="flex-1 text-center font-display text-lg font-bold" aria-live="polite">
                      {it.sets}
                    </span>
                    <IconBtn label="Mais uma série" onClick={() => update(it.key, { sets: Math.min(20, it.sets + 1) })}>
                      <Plus className="size-4" />
                    </IconBtn>
                  </div>
                </div>
                <SmallInput
                  label={it.equipment.muscle_group === "cardio" ? "Minutos" : "Repetições"}
                  value={it.reps}
                  onChange={(v) => update(it.key, { reps: v })}
                  placeholder="10–12"
                  inputMode="text"
                />
                <SmallInput
                  label="Carga sugerida (kg)"
                  value={it.load}
                  onChange={(v) => update(it.key, { load: v })}
                  placeholder={it.equipment.is_bodyweight ? "0" : "—"}
                  inputMode="decimal"
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted" htmlFor={`rest-${it.key}`}>
                    Descanso
                  </label>
                  <select
                    id={`rest-${it.key}`}
                    value={it.rest}
                    onChange={(e) => update(it.key, { rest: Number(e.target.value) })}
                    className={cn(inputClass, "px-3 py-2")}
                  >
                    {[...new Set([...REST_OPTIONS, it.rest])].sort((a, b) => a - b).map((s) => (
                      <option key={s} value={s}>
                        {s === 0 ? "Sem descanso" : formatRest(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[11rem_1fr]">
                <select
                  value={it.technique}
                  onChange={(e) => update(it.key, { technique: e.target.value as Technique | "" })}
                  aria-label={`Técnica de ${it.equipment.name}`}
                  className={cn(inputClass, "px-3 py-2 text-sm")}
                >
                  <option value="">Técnica: normal</option>
                  {TECHNIQUES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  value={it.notes}
                  onChange={(e) => update(it.key, { notes: e.target.value })}
                  maxLength={500}
                  placeholder="Observações (cadência, pegada, amplitude…)"
                  aria-label={`Observações de ${it.equipment.name}`}
                  className={cn(inputClass, "py-2 text-sm")}
                />
              </div>
              {it.technique && <p className="mt-1.5 text-xs text-muted">{techniqueInfo(it.technique)?.hint}</p>}
              {mode === "personal" && (
                <SubstituteSelect item={it} catalog={catalog} cautions={cautions} onChange={(substitute) => update(it.key, { substitute })} />
              )}
            </article>
          );
        })}

        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-bandeira-500/50 py-4 font-display font-bold text-bandeira-600 hover:bg-bandeira-50 dark:text-bandeira-100 dark:hover:bg-bandeira-500/10"
        >
          <Plus className="size-5" aria-hidden /> Adicionar exercício
        </button>
      </section>

      {error && <Alert>{error}</Alert>}

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <Button size="lg" className="w-full shadow-xl" onClick={save} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Salvando…" : "Salvar ficha"}
        </Button>
      </div>

      {picking && (
        <ExercisePicker
          allowRequest={mode === "aluno"}
          cautions={cautions}
          catalog={catalog}
          selectedIds={items.map((i) => i.equipment.id)}
          onPick={addFromCatalog}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function SmallInput({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={cn(inputClass, "px-3 py-2")}
      />
    </label>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl p-2 transition disabled:opacity-30",
        danger ? "text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15" : "text-muted hover:bg-border/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Substituto do exercício para quando o aparelho estiver ocupado (mesmo grupo muscular primeiro). */
function SubstituteSelect({
  item,
  catalog,
  cautions,
  onChange,
}: {
  item: EditorItem;
  catalog: CatalogItem[];
  cautions: Record<string, string[]>;
  onChange: (c: CatalogItem | null) => void;
}) {
  const others = catalog.filter((c) => c.id !== item.equipment.id);
  const same = others.filter((c) => c.muscle_group === item.equipment.muscle_group);
  const rest = others.filter((c) => c.muscle_group !== item.equipment.muscle_group);
  const label = (c: CatalogItem) => `${c.name}${cautions[c.muscle_group] ? " ⚠️" : ""}`;
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-xs font-semibold text-muted">Substituto se o aparelho estiver ocupado (opcional)</span>
      <select
        value={item.substitute?.id ?? ""}
        onChange={(e) => onChange(catalog.find((c) => c.id === e.target.value) ?? null)}
        className={cn(inputClass, "px-3 py-2 text-sm")}
      >
        <option value="">Sem substituto (o app sugere opções com IA)</option>
        {!!same.length && (
          <optgroup label={`${groupLabel(item.equipment.muscle_group)} (mesmo grupo)`}>
            {same.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c)}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Outros grupos">
          {rest.map((c) => (
            <option key={c.id} value={c.id}>
              {label(c)} · {groupLabel(c.muscle_group)}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
