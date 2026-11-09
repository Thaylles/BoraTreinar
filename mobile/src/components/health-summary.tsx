import { Linking, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { groupLabel, type MuscleGroup } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { cautionsFor, labelOf, MULTI_FIELDS, needsClearance, PARQ, SINGLE_FIELDS, type HealthForm } from "@/lib/health";
import { useData } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { Badge, Text } from "~/ui";
import { cx as cn } from "~/ui/cn";

/** Anamnese do aluno para o Personal: riscos, liberação e grupos com cuidado. */
export function HealthSummary({ studentId }: { studentId: string }) {
  const q = useData(["health-summary", studentId], async () => {
    const { data } = await supabase.from("health_forms").select("*").eq("student_id", studentId).maybeSingle();
    const form = data as HealthForm | null;
    const clearance = form?.clearance_path ? ((await supabase.storage.from("medical").createSignedUrl(form.clearance_path, 600)).data?.signedUrl ?? null) : null;
    return { form, clearance };
  });
  if (!q.data) return null;
  const { form, clearance } = q.data;
  if (!form)
    return (
      <View className="mb-6 rounded-3xl border border-dashed border-border p-4">
        <Text className="font-display text-lg font-bold">🩺 Anamnese</Text>
        <Text className="text-sm text-muted">O aluno ainda não preencheu. Ele vê um aviso no início do app para preencher.</Text>
      </View>
    );
  const risk = needsClearance(form);
  const cautions = Object.entries(cautionsFor(form));
  const answered = MULTI_FIELDS.filter((x) => (form[x.key] as string[]).length);
  const Item = ({ k, v }: { k: string; v: string }) => (
    <View>
      <Text className="text-xs font-semibold text-muted">{k}</Text>
      <Text className="text-sm">{v}</Text>
    </View>
  );
  return (
    <View className={cn("mb-6 rounded-3xl border p-4", risk ? "border-pitanga-500/60 bg-pitanga-100/40 dark:bg-pitanga-500/10" : "border-border bg-surface")}>
      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-display text-lg font-bold">🩺 Anamnese</Text>
        <Text className="text-xs text-muted">atualizada em {formatDate(form.updated_at!)}</Text>
      </View>
      {risk ? (
        <View className="mb-3 gap-1">
          <Badge tone="red">⚠️ PAR-Q com “sim”</Badge>
          {form.parq_yes.map((v) => (
            <Text key={v} className="text-sm">• {labelOf(PARQ, v)}</Text>
          ))}
          <View className="flex-row flex-wrap">
            <Text className="text-sm font-semibold">Liberação médica: </Text>
            {clearance ? (
              <Pressable onPress={() => void Linking.openURL(clearance)}>
                <Text className="text-sm font-semibold text-bandeira-600 underline dark:text-bandeira-100">ver arquivo enviado</Text>
              </Pressable>
            ) : (
              <Text className="text-sm font-semibold text-pitanga-600">ainda não enviada</Text>
            )}
          </View>
        </View>
      ) : (
        <View className="mb-3">
          <Badge tone="green">PAR-Q sem restrições</Badge>
        </View>
      )}
      {cautions.length ? (
        <View className="mb-3 rounded-2xl bg-ipe-100 p-3 dark:bg-ipe-500/15">
          <Text className="mb-1 text-sm font-bold text-anil-900 dark:text-ipe-400">Cuidado ao montar a ficha</Text>
          {cautions.map(([g, reasons]) => (
            <Text key={g} className="text-sm text-anil-900 dark:text-ipe-400">
              <Text className="text-sm font-bold text-anil-900 dark:text-ipe-400">{groupLabel(g as MuscleGroup)}</Text>: {reasons.join(", ")}
            </Text>
          ))}
        </View>
      ) : null}
      <View className="gap-1.5">
        {answered.map((x) => (
          <Item key={x.key} k={x.title} v={(form[x.key] as string[]).map((v) => labelOf(x.options, v)).join(", ")} />
        ))}
        {SINGLE_FIELDS.filter((x) => form[x.key]).map((x) => (
          <Item key={x.key} k={x.title} v={labelOf(x.options, form[x.key]!)} />
        ))}
        {form.smoker != null ? <Item k="Fuma?" v={form.smoker ? "Sim" : "Não"} /> : null}
        {form.notes ? <Item k="Observações do aluno" v={`💬 “${form.notes}”`} /> : null}
      </View>
      <Link href="/personal/saude" className="mt-3">
        <Text className="text-xs font-semibold text-anil-700 dark:text-ipe-400">Ver levantamento de todos os alunos →</Text>
      </Link>
    </View>
  );
}
