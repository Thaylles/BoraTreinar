import { useLocalSearchParams } from "expo-router";
import { FileBarChart } from "lucide-react-native";
import type { ReportContent } from "@/lib/report";
import { useData, useRefresh } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { EmptyState, Loading, PageTitle, Screen } from "~/ui";
import { ReportView, SourceVote } from "~/components/report-view";

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default function Relatorio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useData(["report", id], async () => (await supabase.from("weekly_reports").select("id, content, ai_used, emailed_at, updated_at, preferred_source").eq("id", id).maybeSingle()).data);
  const refresh = useRefresh(q);
  if (q.isLoading) return <Loading />;
  if (!q.data)
    return (
      <Screen edges={[]}>
        <EmptyState icon={FileBarChart} title="Relatório não encontrado" />
      </Screen>
    );
  const c = q.data.content as unknown as ReportContent;
  const generated = new Date(q.data.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub={`Gerado em ${generated}${q.data.emailed_at ? " · enviado por e-mail" : ""}`}>
        Semana {ddmm(c.week_start)} a {ddmm(c.week_end)}
      </PageTitle>
      <ReportView content={c} vote={<SourceVote reportId={q.data.id} content={c} preferred={q.data.preferred_source} />} />
    </Screen>
  );
}
