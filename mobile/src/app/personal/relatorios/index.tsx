import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { ChevronRight, FileBarChart, Sparkles } from "lucide-react-native";
import { SOURCE_LABEL, type ReportContent, type SuggestionSource } from "@/lib/report";
import { useData, useRefresh } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { useCall } from "~/lib/use-action";
import { Alert, Button, Card, EmptyState, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default function Relatorios() {
  const t = useTheme();
  const q = useData(["reports"], async () => (await supabase.from("weekly_reports").select("id, week_start, content, ai_used, emailed_at, preferred_source").order("week_start", { ascending: false }).limit(52)).data ?? []);
  const refresh = useRefresh(q);
  const gen = useCall("personal/relatorios#generateReportNow");
  if (!q.data) return <Loading />;
  const votes = new Map<SuggestionSource, number>();
  for (const r of q.data) {
    const src = r.preferred_source as SuggestionSource | null;
    if (src && src in SOURCE_LABEL) votes.set(src, (votes.get(src) ?? 0) + 1);
  }
  const totalVotes = [...votes.values()].reduce((a, b) => a + b, 0);
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Todo domingo às 22h chega um resumo dos seus alunos por e-mail e aqui no app.">Relatórios semanais</PageTitle>
      <View className="mb-6">
        <Button variant="secondary" icon={Sparkles} loading={gen.pending} onPress={() => gen.run()}>
          {gen.pending ? "Gerando relatório…" : "Gerar prévia desta semana agora"}
        </Button>
        <Text className="mt-1 text-center text-xs text-muted">A prévia não envia e-mail; o relatório de domingo atualiza esta semana.</Text>
        {gen.error ? <Alert className="mt-2">{gen.error}</Alert> : null}
      </View>
      {totalVotes > 0 ? (
        <Card className="mb-6 p-4">
          <Text className="mb-2 font-display text-lg font-bold">Placar das sugestões</Text>
          {(Object.keys(SOURCE_LABEL) as SuggestionSource[])
            .filter((src) => votes.has(src))
            .sort((a, b) => (votes.get(b) ?? 0) - (votes.get(a) ?? 0))
            .map((src) => {
              const n = votes.get(src) ?? 0;
              return (
                <View key={src} className="mb-2">
                  <View className="mb-1 flex-row justify-between gap-2">
                    <Text className="text-sm font-semibold">{SOURCE_LABEL[src]}</Text>
                    <Text className="text-sm text-muted">
                      {n} {n === 1 ? "semana" : "semanas"}
                    </Text>
                  </View>
                  <View className="h-2 rounded-full bg-border/50">
                    <View className="h-2 rounded-full bg-bandeira-500" style={{ width: `${(n / totalVotes) * 100}%` }} />
                  </View>
                </View>
              );
            })}
          <Text className="mt-2 text-xs text-muted">Vote em cada relatório qual sugestão foi mais útil.</Text>
        </Card>
      ) : null}
      {!q.data.length ? (
        <EmptyState icon={FileBarChart} title="Nenhum relatório ainda">
          O primeiro chega no domingo às 22h.
        </EmptyState>
      ) : (
        <View className="gap-2">
          {q.data.map((r) => {
            const c = r.content as unknown as ReportContent;
            const total = c.students.reduce((a, s) => a + s.sessions, 0);
            const trained = c.students.filter((s) => s.sessions > 0).length;
            return (
              <Link key={r.id} href={`/personal/relatorios/${r.id}`} asChild>
                <Pressable className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                  <FileBarChart color={t.bandeira500} size={24} />
                  <View className="min-w-0 flex-1">
                    <Text className="font-display font-bold">
                      Semana {ddmm(c.week_start)} a {ddmm(c.week_end)}
                    </Text>
                    <Text className="text-xs text-muted">
                      {total} {total === 1 ? "treino" : "treinos"} · {trained} de {c.students.length} {c.students.length === 1 ? "aluno treinou" : "alunos treinaram"}
                      {r.emailed_at ? " · enviado por e-mail" : ""}
                      {r.ai_used ? " · com IA" : ""}
                      {r.preferred_source && r.preferred_source in SOURCE_LABEL ? ` · preferida: ${SOURCE_LABEL[r.preferred_source as SuggestionSource].split(" (")[0]}` : ""}
                    </Text>
                  </View>
                  <ChevronRight color={t.muted} size={20} />
                </Pressable>
              </Link>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
