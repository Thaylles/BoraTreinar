import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Check, ClipboardList, Users } from "lucide-react-native";
import { useData } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { useFormAction } from "~/lib/use-action";
import { Button, EmptyState, FormMessage, Loading, PageTitle, Screen, Text } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Checkbox } from "~/ui/forms";

function CheckRow({ checked, onPress, title, detail }: { checked: boolean; onPress: () => void; title: string; detail?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityState={{ checked }} className={cn("flex-row items-center gap-3 rounded-2xl border-2 p-3", checked ? "border-bandeira-500 bg-bandeira-50 dark:bg-bandeira-500/10" : "border-border bg-surface")}>
      <View className={cn("size-6 items-center justify-center rounded-md border-2", checked ? "border-bandeira-500 bg-bandeira-500" : "border-border")}>{checked ? <Check color="#fff" size={14} /> : null}</View>
      <View className="min-w-0 flex-1">
        <Text className="font-semibold" numberOfLines={1}>{title}</Text>
        {detail ? <Text className="text-xs text-muted" numberOfLines={1}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function AplicarEmLote() {
  const profile = useProfile();
  const { ficha } = useLocalSearchParams<{ ficha?: string }>();
  const q = useData(["bulk-apply", profile.id, ficha ?? ""], async () => {
    const [{ data: templates }, { data: source }, { data: links }] = await Promise.all([
      supabase.from("workout_plans").select("id, name, goal, items:workout_plan_items(count)").eq("is_template", true).eq("created_by", profile.id).order("name"),
      ficha ? supabase.from("workout_plans").select("id, name, goal, is_template, student:profiles!workout_plans_student_id_fkey(full_name), items:workout_plan_items(count)").eq("id", ficha).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("personal_students").select("student:profiles!personal_students_student_id_fkey(id, full_name)").eq("personal_id", profile.id).eq("status", "ativo").is("archived_at", null),
    ]);
    const students = (links ?? []).map((l) => l.student).filter((s): s is { id: string; full_name: string } => !!s).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
    const { data: active } = students.length ? await supabase.from("workout_plans").select("student_id").in("student_id", students.map((s) => s.id)).eq("is_template", false).is("archived_at", null) : { data: [] as { student_id: string | null }[] };
    const activeOf = new Map<string, number>();
    for (const p of active ?? []) if (p.student_id) activeOf.set(p.student_id, (activeOf.get(p.student_id) ?? 0) + 1);
    const detail = (n: number, goal: string | null) => `${n} exercícios${goal ? ` · ${goal}` : ""}`;
    const plans = (templates ?? []).map((tp) => ({ id: tp.id, name: tp.name, detail: `Modelo · ${detail(tp.items[0]?.count ?? 0, tp.goal)}` }));
    if (source && !source.is_template) plans.unshift({ id: source.id, name: source.name, detail: `Ficha de ${source.student?.full_name ?? "aluno"} · ${detail(source.items[0]?.count ?? 0, source.goal)}` });
    return { plans, students: students.map((s) => ({ id: s.id, name: s.full_name, activePlans: activeOf.get(s.id) ?? 0 })), preselected: source ? [source.id] : [] };
  });
  const [selPlans, setSelPlans] = useState<string[] | null>(null);
  const [selStudents, setSelStudents] = useState<string[]>([]);
  const [archive, setArchive] = useState(true);
  const { state, pending, submit } = useFormAction("personal/fichas#applyPlansBulk");
  if (!q.data) return <Loading />;
  const { plans, students } = q.data;
  const chosen = selPlans ?? q.data.preselected;
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const allStudents = selStudents.length === students.length && students.length > 0;
  const toArchive = archive ? students.filter((s) => selStudents.includes(s.id)).reduce((a, s) => a + s.activePlans, 0) : 0;
  const total = chosen.length * selStudents.length;
  return (
    <Screen edges={[]}>
      <PageTitle sub="Escolha as fichas e os alunos: cada aluno recebe uma cópia própria, que você pode ajustar depois.">Aplicar a vários alunos</PageTitle>
      {!plans.length ? (
        <EmptyState icon={ClipboardList} title="Nenhum modelo ainda">
          Crie modelos em Modelos ou use &quot;Salvar como modelo&quot; numa ficha.
        </EmptyState>
      ) : !students.length ? (
        <EmptyState icon={Users} title="Nenhum aluno ativo">
          Convide alunos para aplicar as fichas.
        </EmptyState>
      ) : (
        <View className="gap-6">
          <View>
            <Text className="mb-2 font-display text-lg font-bold">1. Fichas ou modelos</Text>
            <View className="gap-2">
              {plans.map((p) => (
                <CheckRow key={p.id} checked={chosen.includes(p.id)} onPress={() => toggle(chosen, setSelPlans, p.id)} title={p.name} detail={p.detail} />
              ))}
            </View>
          </View>
          <View>
            <View className="mb-2 flex-row items-center justify-between gap-2">
              <Text className="font-display text-lg font-bold">2. Alunos</Text>
              <Pressable onPress={() => setSelStudents(allStudents ? [] : students.map((s) => s.id))}>
                <Text className="text-sm font-semibold text-bandeira-600 dark:text-bandeira-100">{allStudents ? "Limpar seleção" : "Selecionar todos"}</Text>
              </Pressable>
            </View>
            <View className="gap-2">
              {students.map((s) => (
                <CheckRow key={s.id} checked={selStudents.includes(s.id)} onPress={() => toggle(selStudents, setSelStudents, s.id)} title={s.name} detail={`${s.activePlans} ${s.activePlans === 1 ? "ficha ativa" : "fichas ativas"}`} />
              ))}
            </View>
          </View>
          <View className="rounded-2xl border border-border bg-surface p-3">
            <Checkbox checked={archive} onChange={setArchive}>
              Substituir as fichas atuais (arquiva as fichas ativas desses alunos antes de aplicar as novas; dá para reativar depois)
            </Checkbox>
          </View>
          <View className="rounded-3xl border border-border bg-surface p-4">
            <Text className="mb-3 text-sm">
              {total
                ? `Serão criadas ${total} ${total === 1 ? "ficha" : "fichas"} (${chosen.length} × ${selStudents.length} ${selStudents.length === 1 ? "aluno" : "alunos"})${toArchive > 0 ? ` e ${toArchive} ${toArchive === 1 ? "ficha antiga será arquivada" : "fichas antigas serão arquivadas"}` : ""}.`
                : "Escolha as fichas e os alunos."}
            </Text>
            <FormMessage state={state} />
            <Button className="mt-2" disabled={!total} loading={pending} onPress={() => submit({ plan: chosen, student: selStudents, archive: archive ? "1" : undefined })}>
              {`Aplicar ${total ? `${total} ${total === 1 ? "ficha" : "fichas"}` : ""}`}
            </Button>
          </View>
        </View>
      )}
    </Screen>
  );
}
