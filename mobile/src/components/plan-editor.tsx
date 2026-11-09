import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { ArrowDown, ArrowUp, Minus, Plus, Trash2 } from "lucide-react-native";
import { equipmentImageSrc, groupLabel } from "@/lib/catalog";
import { formatRest, parseReps, REST_OPTIONS, TECHNIQUES, techniqueInfo, type Technique } from "@/lib/plans";
import type { EditorInitial, EditorItem } from "@/components/plans/plan-editor";
import type { PlanPayload } from "@/app/personal/fichas/actions";
import { useCall } from "~/lib/use-action";
import { Alert, Button, inputClass, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { DateField, Select, TextField } from "~/ui/forms";
import { ExercisePicker, type CatalogItem } from "./exercise-picker";

export type { EditorInitial, EditorItem };
let keySeq = 0;
const newKey = () => `i${++keySeq}`;
const parseKg = (s: string): number | null | undefined => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 9999 ? n : undefined;
};

/** Montar/editar ficha (Personal, aluno e modelos) — mesmas regras do site. */
export function PlanEditor({
  initial,
  catalog,
  cautions = {},
  mode = "personal",
}: {
  initial: EditorInitial;
  catalog: CatalogItem[];
  mode?: "personal" | "aluno";
  cautions?: Record<string, string[]>;
}) {
  const t = useTheme();
  const [name, setName] = useState(initial.name);
  const [goal, setGoal] = useState(initial.goal);
  const [notes, setNotes] = useState(initial.notes);
  const [validUntil, setValidUntil] = useState(initial.validUntil);
  const [items, setItems] = useState<EditorItem[]>(() => initial.items.map((i) => ({ ...i, key: newKey() })));
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useCall(mode === "aluno" ? "aluno/fichas#saveMyPlan" : "personal/fichas#savePlan");

  const update = (key: string, patch: Partial<EditorItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list];
      const [it] = next.splice(index, 1);
      next.splice(index + delta, 0, it);
      return next;
    });
  const addFromCatalog = (c: CatalogItem) =>
    setItems((list) => [
      ...list,
      { key: newKey(), equipment: c, sets: 3, reps: c.muscle_group === "cardio" ? "20" : "10–12", load: "", rest: c.muscle_group === "cardio" ? 0 : 60, notes: "", technique: "", substitute: null },
    ]);
  const removeFromCatalog = (c: CatalogItem) =>
    setItems((list) => {
      let last = -1;
      list.forEach((i, k) => {
        if (i.equipment.id === c.id) last = k;
      });
      return last < 0 ? list : list.filter((_, k) => k !== last);
    });

  async function onSave() {
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
    const r = await save.run<{ error?: string } | null>(
      mode === "aluno"
        ? { planId: initial.planId, name, goal, notes, items: payloadItems }
        : { planId: initial.planId, studentId: initial.studentId, name, goal, notes, validUntil, items: payloadItems },
    );
    if (r?.result?.error) setError(r.result.error);
  }

  return (
    <View className="gap-6">
      <View className="gap-4 rounded-3xl border border-border bg-surface p-5">
        <TextField label="Nome da ficha" value={name} onChangeText={setName} maxLength={60} placeholder="Ex.: Treino A — Peito e tríceps" />
        <TextField label="Objetivo" value={goal} onChangeText={setGoal} maxLength={200} placeholder="Ex.: Hipertrofia, resistência…" />
        <TextField label="Observações gerais" value={notes} onChangeText={setNotes} maxLength={2000} multiline placeholder="Aquecimento, cadência, cuidados…" style={{ minHeight: 64, textAlignVertical: "top" }} />
        {mode === "personal" && initial.studentId !== null ? (
          <DateField label="Válida até (opcional)" value={validUntil} onChange={setValidUntil} />
        ) : null}
      </View>

      <View className="gap-3">
        <Text className="font-display text-xl font-bold">Exercícios ({items.length})</Text>
        {Object.keys(cautions).length ? (
          <View className="rounded-2xl bg-ipe-100 p-3 dark:bg-ipe-500/15">
            <Text className="text-sm font-bold text-anil-900 dark:text-ipe-400">🩺 Pela anamnese, cuidado com:</Text>
            {Object.entries(cautions).map(([g, reasons]) => (
              <Text key={g} className="mt-0.5 text-sm text-anil-900 dark:text-ipe-400">
                <Text className="text-sm font-bold text-anil-900 dark:text-ipe-400">{groupLabel(g as CatalogItem["muscle_group"])}</Text>: {reasons.join(", ")}
              </Text>
            ))}
            <Text className="mt-1 text-xs text-anil-900 dark:text-ipe-400">Prefira menos volume, variações sem dor e boa amplitude controlada nesses grupos.</Text>
          </View>
        ) : null}
        {items.map((it, idx) => {
          const src = equipmentImageSrc(it.equipment);
          return (
            <View key={it.key} className="rounded-3xl border border-border bg-surface p-4">
              <View className="flex-row items-start gap-3">
                <View className="mt-1 size-7 items-center justify-center rounded-full bg-anil-700 dark:bg-ipe-500">
                  <Text className="text-sm font-bold text-white dark:text-anil-900">{idx + 1}</Text>
                </View>
                {src ? <Image source={src} style={{ width: 48, height: 48, borderRadius: 12 }} contentFit="cover" /> : null}
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold leading-tight">{it.equipment.name}</Text>
                  <Text className="text-xs text-muted">{groupLabel(it.equipment.muscle_group)}</Text>
                  {cautions[it.equipment.muscle_group] ? <Text className="text-xs font-semibold text-pitanga-600">⚠️ Atenção: {cautions[it.equipment.muscle_group].join(", ")}</Text> : null}
                </View>
                <View className="flex-row">
                  <IconBtn label="Subir" disabled={idx === 0} onPress={() => move(idx, -1)}>
                    <ArrowUp color={t.muted} size={16} />
                  </IconBtn>
                  <IconBtn label="Descer" disabled={idx === items.length - 1} onPress={() => move(idx, 1)}>
                    <ArrowDown color={t.muted} size={16} />
                  </IconBtn>
                  <IconBtn label="Remover" onPress={() => setItems((l) => l.filter((x) => x.key !== it.key))}>
                    <Trash2 color={t.pitanga600} size={16} />
                  </IconBtn>
                </View>
              </View>

              <View className="mt-3 flex-row flex-wrap gap-3">
                <View style={{ width: "47%" }}>
                  <Text className="mb-1 text-xs font-semibold text-muted">Séries</Text>
                  <View className="flex-row items-center rounded-2xl border border-border">
                    <IconBtn label="Menos uma série" onPress={() => update(it.key, { sets: Math.max(1, it.sets - 1) })}>
                      <Minus color={t.muted} size={16} />
                    </IconBtn>
                    <Text className="flex-1 text-center font-display text-lg font-bold">{it.sets}</Text>
                    <IconBtn label="Mais uma série" onPress={() => update(it.key, { sets: Math.min(20, it.sets + 1) })}>
                      <Plus color={t.muted} size={16} />
                    </IconBtn>
                  </View>
                </View>
                <SmallInput label={it.equipment.muscle_group === "cardio" ? "Minutos" : "Repetições"} value={it.reps} onChange={(v) => update(it.key, { reps: v })} placeholder="10–12" />
                <SmallInput label="Carga sugerida (kg)" value={it.load} onChange={(v) => update(it.key, { load: v })} placeholder={it.equipment.is_bodyweight ? "0" : "—"} keyboard="decimal-pad" />
                <View style={{ width: "47%" }}>
                  <Text className="mb-1 text-xs font-semibold text-muted">Descanso</Text>
                  <Select
                    value={String(it.rest)}
                    onChange={(v) => update(it.key, { rest: Number(v) })}
                    options={[...new Set([...REST_OPTIONS, it.rest])].sort((a, b) => a - b).map((s) => ({ value: String(s), label: s === 0 ? "Sem descanso" : formatRest(s) }))}
                  />
                </View>
              </View>
              <View className="mt-3 gap-3">
                <Select
                  value={it.technique || "normal"}
                  onChange={(v) => update(it.key, { technique: v === "normal" ? "" : (v as Technique) })}
                  options={[{ value: "normal", label: "Técnica: normal" }, ...TECHNIQUES.map((x) => ({ value: x.value as string, label: x.label }))]}
                />
                <TextInput
                  value={it.notes}
                  onChangeText={(v) => update(it.key, { notes: v })}
                  maxLength={500}
                  placeholder="Observações (cadência, pegada, amplitude…)"
                  placeholderTextColor={t.muted}
                  accessibilityLabel={`Observações de ${it.equipment.name}`}
                  className={cn(inputClass, "py-2 text-sm")}
                  style={{ fontFamily: "Inter_400Regular" }}
                />
              </View>
              {it.technique ? <Text className="mt-1.5 text-xs text-muted">{techniqueInfo(it.technique)?.hint}</Text> : null}
              {mode === "personal" ? <SubstituteSelect item={it} catalog={catalog} cautions={cautions} onChange={(substitute) => update(it.key, { substitute })} /> : null}
            </View>
          );
        })}

        <Pressable onPress={() => setPicking(true)} className="flex-row items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-bandeira-500/50 py-4 active:bg-bandeira-50">
          <Plus color={t.dark ? t.bandeira100 : t.bandeira600} size={20} />
          <Text className="font-display font-bold text-bandeira-600 dark:text-bandeira-100">Adicionar exercício</Text>
        </Pressable>
      </View>

      {error || save.error ? <Alert>{error ?? save.error ?? ""}</Alert> : null}
      <Button size="lg" onPress={onSave} loading={save.pending}>
        {save.pending ? "Salvando…" : "Salvar ficha"}
      </Button>

      {picking ? (
        <ExercisePicker
          allowRequest={mode === "aluno"}
          cautions={cautions}
          catalog={catalog}
          selectedIds={items.map((i) => i.equipment.id)}
          onPick={addFromCatalog}
          onRepeat={addFromCatalog}
          onRemove={removeFromCatalog}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </View>
  );
}

function SmallInput({ label, value, onChange, placeholder, keyboard }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboard?: "decimal-pad" }) {
  const t = useTheme();
  return (
    <View style={{ width: "47%" }}>
      <Text className="mb-1 text-xs font-semibold text-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        keyboardType={keyboard ?? "default"}
        className={cn(inputClass, "px-3 py-2")}
        style={{ fontFamily: "Inter_400Regular" }}
      />
    </View>
  );
}

function IconBtn({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} disabled={disabled} className={cn("rounded-xl p-2", disabled && "opacity-30")}>
      {children}
    </Pressable>
  );
}

function SubstituteSelect({ item, catalog, cautions, onChange }: { item: EditorItem; catalog: CatalogItem[]; cautions: Record<string, string[]>; onChange: (c: CatalogItem | null) => void }) {
  const others = catalog.filter((c) => c.id !== item.equipment.id);
  const label = (c: CatalogItem) => `${c.name}${cautions[c.muscle_group] ? " ⚠️" : ""}`;
  const sameGroup = `${groupLabel(item.equipment.muscle_group)} (mesmo grupo)`;
  return (
    <View className="mt-3">
      <Text className="mb-1 text-xs font-semibold text-muted">Substituto se o aparelho estiver ocupado (opcional)</Text>
      <Select
        value={item.substitute?.id ?? "none"}
        onChange={(v) => onChange(catalog.find((c) => c.id === v) ?? null)}
        options={[
          { value: "none", label: "Sem substituto (o app sugere opções com IA)" },
          ...others.filter((c) => c.muscle_group === item.equipment.muscle_group).map((c) => ({ value: c.id, label: label(c), group: sameGroup })),
          ...others.filter((c) => c.muscle_group !== item.equipment.muscle_group).map((c) => ({ value: c.id, label: `${label(c)} · ${groupLabel(c.muscle_group)}`, group: "Outros grupos" })),
        ]}
      />
    </View>
  );
}
