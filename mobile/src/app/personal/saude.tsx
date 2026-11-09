import { View } from "react-native";
import { Link } from "expo-router";
import { healthSurvey, needsClearance, type HealthForm } from "@/lib/health";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Card, Loading, PageTitle, Screen, Text } from "~/ui";

function Bars({ items, total }: { items: { value: string; label: string; n: number }[]; total: number }) {
  if (!items.length) return <Text className="text-sm text-muted">Ninguém marcou.</Text>;
  return (
    <View className="gap-1.5">
      {items.map((x) => (
        <View key={x.value}>
          <View className="flex-row justify-between gap-2">
            <Text className="flex-1 text-sm">{x.label}</Text>
            <Text className="text-sm font-semibold">
              {x.n} <Text className="text-xs text-muted">({Math.round((x.n / total) * 100)}%)</Text>
            </Text>
          </View>
          <View className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-border/60">
            <View className="h-full rounded-full bg-bandeira-500" style={{ width: `${(x.n / total) * 100}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function LevantamentoSaude() {
  const profile = useProfile();
  const q = useData(["health-survey", profile.id], async () => {
    const { data: links } = await supabase.from("personal_students").select("student_id, student:profiles!personal_students_student_id_fkey(full_name)").eq("personal_id", profile.id).eq("status", "ativo").is("archived_at", null);
    const ids = (links ?? []).map((l) => l.student_id).filter((id) => id !== profile.id);
    const { data } = ids.length ? await supabase.from("health_forms").select("*").in("student_id", ids) : { data: [] };
    return { links: links ?? [], ids, forms: (data ?? []) as (HealthForm & { student_id: string })[] };
  });
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  const { links, ids, forms } = q.data;
  const s = healthSurvey(forms);
  const nameOf = (id: string) => links.find((l) => l.student_id === id)?.student?.full_name ?? "Aluno";
  const missing = ids.filter((id) => !forms.some((f) => f.student_id === id));
  const atRisk = forms.filter(needsClearance);
  const Box = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card className="p-4">
      <Text className="mb-2 font-display font-bold">{title}</Text>
      {children}
    </Card>
  );
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub={`${s.total} de ${ids.length} alunos ativos preencheram a anamnese.`}>Levantamento de saúde 🩺</PageTitle>
      {atRisk.length ? (
        <View className="mb-4 rounded-3xl border-2 border-pitanga-500/60 bg-pitanga-100/50 p-4 dark:bg-pitanga-500/10">
          <Text className="mb-2 font-display text-lg font-bold">⚠️ PAR-Q com “sim” ({atRisk.length})</Text>
          {atRisk.map((f) => (
            <View key={f.student_id} className="flex-row flex-wrap">
              <Link href={`/personal/alunos/${f.student_id}`}>
                <Text className="text-sm font-semibold underline">{nameOf(f.student_id)}</Text>
              </Link>
              <Text className="text-sm"> · {f.clearance_path ? "✅ liberação enviada" : "📄 sem liberação médica"}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {missing.length ? (
        <View className="mb-4 rounded-3xl border border-dashed border-border p-4">
          <Text className="mb-1 text-sm font-bold">Ainda não preencheram ({missing.length})</Text>
          <Text className="text-sm text-muted">{missing.map(nameOf).join(", ")}</Text>
        </View>
      ) : null}
      {s.total > 0 ? (
        <View className="gap-4">
          <Box title="PAR-Q: perguntas com “sim”">
            <Bars items={s.parq} total={s.total} />
          </Box>
          {s.multi.map((m) => (
            <Box key={m.key} title={m.title}>
              <Bars items={m.counts} total={s.total} />
            </Box>
          ))}
          {s.single.map((m) => (
            <Box key={m.key} title={m.title}>
              <Bars items={m.counts} total={s.total} />
            </Box>
          ))}
          <Box title="Fumantes">
            <Bars items={s.smokers ? [{ value: "sim", label: "Fumam", n: s.smokers }] : []} total={s.total} />
          </Box>
        </View>
      ) : null}
    </Screen>
  );
}
