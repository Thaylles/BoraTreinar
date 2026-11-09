import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { ChevronRight, Users } from "lucide-react-native";
import { daysAgoLabel, daysAgoSP, startOfWeekSP } from "@/lib/week";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { useCall } from "~/lib/use-action";
import { Badge, Card, EmptyState, LinkButton, Loading, PageTitle, Row, Screen, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Avatar, Disclosure, WhatsAppButton } from "~/ui/extras";
import { Segmented } from "~/ui/forms";
import { AddExistingStudent } from "~/components/add-existing-student";

function StudentStatus({ week, last }: { week: number; last: string | null }) {
  const days = last ? daysAgoSP(last) : null;
  const tone = days == null || days > 7 ? "bg-pitanga-500" : days > 3 ? "bg-ipe-500" : "bg-bandeira-500";
  return (
    <View className="flex-row flex-wrap items-center gap-x-2">
      <View className={cn("size-2 rounded-full", tone)} />
      <Text className="text-xs text-muted">
        <Text className="text-xs font-bold">{week}</Text> na semana · {last ? `último ${daysAgoLabel(days!)}` : "nunca treinou"}
      </Text>
      {days != null && days > 7 ? <Text className="text-xs font-semibold text-pitanga-600">· sem treinar há {days} dias</Text> : null}
    </View>
  );
}

export default function Alunos() {
  const profile = useProfile();
  const t = useTheme();
  const [archived, setArchived] = useState(false);
  const cancel = useCall("personal/alunos/vinculo-actions#cancelLink");
  const q = useData(["personal-students", profile.id, archived], async () => {
    let query = supabase.from("personal_students").select("role, archived_at, student:profiles!personal_students_student_id_fkey(id, full_name, phone, avatar_path)").eq("personal_id", profile.id).eq("status", "ativo");
    query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
    const [{ data: links }, { data: requests }] = await Promise.all([
      query,
      supabase.from("link_requests").select("id, student:profiles!link_requests_student_id_fkey(full_name, avatar_path)").eq("personal_id", profile.id).eq("status", "pendente").order("created_at", { ascending: false }),
    ]);
    const ids = (links ?? []).map((l) => l.student?.id).filter((x): x is string => !!x);
    const { data: recent } = ids.length
      ? await supabase.from("workout_sessions").select("student_id, started_at").in("student_id", ids).gte("started_at", new Date(Date.now() - 90 * 86_400_000).toISOString()).order("started_at", { ascending: false })
      : { data: [] as { student_id: string; started_at: string }[] };
    return { links: links ?? [], requests: requests ?? [], recent: recent ?? [] };
  }, { placeholderData: (p) => p });
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  const weekStart = startOfWeekSP();
  const statsFor = (sid: string) => {
    const mine = q.data!.recent.filter((r) => r.student_id === sid);
    return { week: mine.filter((r) => r.started_at >= weekStart).length, last: mine[0]?.started_at ?? null };
  };
  const students = q.data.links.filter((l) => l.student).sort((a, b) => a.student!.full_name.localeCompare(b.student!.full_name, "pt-BR"));
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub={`${students.length} ${archived ? "arquivado(s)" : "ativo(s)"}`}>Alunos</PageTitle>
      {!archived ? (
        <View className="mb-4 rounded-3xl border border-border bg-surface p-4">
          <Disclosure label="+ Adicionar aluno que já tem conta">
            <Text className="mb-3 mt-1 text-sm text-muted">Busque pelo e-mail ou WhatsApp. O aluno recebe um aviso e confirma no app (sem precisar de link).</Text>
            <AddExistingStudent />
          </Disclosure>
          {q.data.requests.length ? (
            <View className="mt-4">
              <Text className="mb-2 text-sm font-semibold">Aguardando o aluno confirmar</Text>
              {q.data.requests.map((r) => (
                <View key={r.id} className="mb-2 flex-row items-center gap-3 rounded-2xl bg-background p-2">
                  <Avatar path={r.student?.avatar_path} name={r.student?.full_name ?? "?"} size={32} />
                  <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>{r.student?.full_name}</Text>
                  <Pressable onPress={async () => (await confirmAsk("Cancelar o pedido?")) && cancel.run(form({ id: r.id }))}>
                    <Text className="text-xs font-semibold text-pitanga-600">Cancelar</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <Row href="/personal/saude" className="mb-4" left={<Text className="text-xl">🩺</Text>} title="Levantamento de saúde dos alunos (anamnese)" right={<ChevronRight color={t.muted} size={16} />} />
      <View className="mb-4">
        <Segmented options={[{ value: "0", label: "Ativos" }, { value: "1", label: "Arquivados" }]} value={archived ? "1" : "0"} onChange={(v) => setArchived(v === "1")} />
      </View>
      {!students.length ? (
        <EmptyState icon={Users} title={archived ? "Nenhum aluno arquivado" : "Nenhum aluno ainda"}>
          {!archived ? (
            <LinkButton href="/personal/convites" className="mt-3">
              Convidar aluno
            </LinkButton>
          ) : undefined}
        </EmptyState>
      ) : (
        <View className="gap-2">
          {students.map(({ student, role }) => (
            <View key={student!.id} className="flex-row items-center gap-2">
              <Link href={`/personal/alunos/${student!.id}`} asChild>
                <Pressable className="min-w-0 flex-1">
                  <Card className="flex-row items-center gap-3 p-4">
                    <Avatar path={student!.avatar_path} name={student!.full_name} size={44} />
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold" numberOfLines={1}>{student!.full_name}</Text>
                      <StudentStatus {...statsFor(student!.id)} />
                    </View>
                    {role === "compartilhado" ? <Badge tone="blue">Compartilhado</Badge> : null}
                    <ChevronRight color={t.muted} size={20} />
                  </Card>
                </Pressable>
              </Link>
              <WhatsAppButton phone={student!.phone} compact />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
