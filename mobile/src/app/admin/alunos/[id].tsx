import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { ChevronRight, Users } from "lucide-react-native";
import { formatDate } from "@/lib/format";
import { formatPhoneBR } from "@/lib/phone";
import { daysAgoLabel, daysAgoSP } from "@/lib/week";
import { adminData } from "~/lib/admin-data";
import { useData, useRefresh } from "~/lib/data";
import { Badge, Card, EmptyState, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { AdminProfileForm } from "~/components/admin-forms";

export default function AdminAluno() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const q = useData(["admin-student", id], () => adminData("adminStudentData", id));
  const refresh = useRefresh(q);
  if (q.isLoading) return <Loading />;
  if (!q.data)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Users} title="Aluno não encontrado" />
      </Screen>
    );
  const { student: s, links, settings } = q.data;
  const stats = [
    { label: "Treinos no total", value: q.data.total },
    { label: "Treinos na semana", value: q.data.week },
    { label: "Fichas ativas", value: q.data.plans },
  ];
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub={`${s.email} · ${formatPhoneBR(s.phone) || "sem telefone"} · desde ${formatDate(s.created_at)}`}>{s.full_name}</PageTitle>
      <View className="mb-4 flex-row gap-2">
        {stats.map((x) => (
          <Card key={x.label} className="flex-1 p-3">
            <Text className="font-display text-2xl font-extrabold">{x.value}</Text>
            <Text className="text-xs text-muted">{x.label}</Text>
          </Card>
        ))}
      </View>
      <Text className="mb-6 text-sm text-muted">
        Último treino: {q.data.last ? daysAgoLabel(daysAgoSP(q.data.last)) : "nunca"} · Pesagem {settings?.weigh_in_frequency ?? "semanal"} · Peso {settings?.weight_visible_to_personal ? "visível" : "oculto"} para os Personais
      </Text>
      <View className="mb-6">
        <Text className="mb-2 font-display text-xl font-bold">Personais</Text>
        {links.length ? (
          <View className="gap-2">
            {links.map((l) => (
              <Link key={l.personal?.id} href={`/admin/personais/${l.personal?.id}`} asChild>
                <Pressable className="flex-row items-center gap-2 rounded-2xl border border-border bg-surface p-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-semibold" numberOfLines={1}>{l.personal?.full_name}</Text>
                    <Text className="text-xs text-muted" numberOfLines={1}>{l.personal?.email}</Text>
                  </View>
                  <Badge tone={l.role === "responsavel" ? "green" : "blue"}>{l.role === "responsavel" ? "Responsável" : "Compartilhado"}</Badge>
                  {l.status !== "ativo" ? <Badge tone="red">{l.status}</Badge> : null}
                  <ChevronRight color={t.muted} size={16} />
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted">Sem Personal vinculado.</Text>
        )}
      </View>
      <Card>
        <Text className="mb-3 font-display text-lg font-bold">Dados de cadastro</Text>
        <AdminProfileForm profile={s} />
      </Card>
    </Screen>
  );
}
