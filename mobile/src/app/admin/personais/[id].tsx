import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { ChevronRight, Lock, LockOpen, Trash2, UserRound } from "lucide-react-native";
import { formatDate } from "@/lib/format";
import { formatPhoneBR } from "@/lib/phone";
import { daysAgoLabel, daysAgoSP } from "@/lib/week";
import { form } from "~/lib/api";
import { adminData } from "~/lib/admin-data";
import { useData, useRefresh } from "~/lib/data";
import { useCall } from "~/lib/use-action";
import { Badge, Button, Card, EmptyState, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { AdminProfileForm, DeletePersonalForm } from "~/components/admin-forms";

export default function AdminPersonal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const q = useData(["admin-personal", id], () => adminData("adminPersonalData", id));
  const refresh = useRefresh(q);
  const block = useCall("admin#adminSetCatalogBlocked");
  if (q.isLoading) return <Loading />;
  if (!q.data)
    return (
      <Screen edges={[]}>
        <EmptyState icon={UserRound} title="Personal não encontrado" />
      </Screen>
    );
  const { personal: p, active, lastOf } = q.data;
  const stats = [
    { label: "Alunos ativos", value: active.length },
    { label: "Fichas criadas", value: q.data.plans },
    { label: "Exercícios próprios", value: q.data.exercises },
    { label: "Convites abertos", value: q.data.invites },
    { label: "Aulas na agenda", value: q.data.classes },
  ];
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub={`${p.email} · ${formatPhoneBR(p.phone) || "sem telefone"} · desde ${formatDate(p.created_at)}`}>{p.full_name}</PageTitle>
      <View className="mb-6 flex-row flex-wrap gap-2">
        {stats.map((s) => (
          <Card key={s.label} className="p-3" style={{ width: "31.5%" }}>
            <Text className="font-display text-2xl font-extrabold">{s.value}</Text>
            <Text className="text-xs text-muted">{s.label}</Text>
          </Card>
        ))}
      </View>
      <Card className={cn("mb-6", p.catalog_blocked && "border-pitanga-500/50")}>
        <View className="mb-1 flex-row items-center gap-2">
          {p.catalog_blocked ? <Lock color={t.pitanga600} size={20} /> : <LockOpen color={t.bandeira500} size={20} />}
          <Text className="font-display text-lg font-bold">Edição de exercícios e máquinas</Text>
        </View>
        <Text className="mb-3 text-sm text-muted">
          {p.catalog_blocked
            ? "Bloqueado: este Personal não cria, edita, exclui nem troca fotos de exercícios. Ele continua montando fichas com o catálogo."
            : "Liberado: este Personal pode criar e editar os próprios exercícios e trocar fotos do catálogo padrão (exceto os travados)."}
        </Text>
        <Button variant={p.catalog_blocked ? "primary" : "danger"} className="self-start" loading={block.pending} onPress={() => block.run(form({ id: p.id, blocked: p.catalog_blocked ? "0" : "1" }))}>
          {p.catalog_blocked ? "Liberar edição" : "Bloquear edição"}
        </Button>
      </Card>
      <View className="mb-6">
        <Text className="mb-2 font-display text-xl font-bold">Alunos ({active.length})</Text>
        {active.length ? (
          <View className="gap-2">
            {active.map((l) => {
              const last = lastOf[l.student!.id];
              return (
                <Link key={l.student!.id} href={`/admin/alunos/${l.student!.id}`} asChild>
                  <Pressable className="flex-row flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3">
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>{l.student!.full_name}</Text>
                      <Text className="text-xs text-muted" numberOfLines={1}>{l.student!.email}</Text>
                      <Text className="text-xs text-muted">{last ? `treinou ${daysAgoLabel(daysAgoSP(last))}` : "nunca treinou"}</Text>
                    </View>
                    <Badge tone={l.role === "responsavel" ? "green" : "blue"}>{l.role === "responsavel" ? "Responsável" : "Compartilhado"}</Badge>
                    {l.archived_at ? <Badge>Arquivado</Badge> : null}
                    <ChevronRight color={t.muted} size={16} />
                  </Pressable>
                </Link>
              );
            })}
          </View>
        ) : (
          <Text className="text-sm text-muted">Nenhum aluno vinculado.</Text>
        )}
      </View>
      <Card className="mb-6">
        <Text className="mb-3 font-display text-lg font-bold">Dados de cadastro</Text>
        <AdminProfileForm profile={p} />
      </Card>
      <Card className="border-pitanga-500/40">
        <View className="mb-1 flex-row items-center gap-2">
          <Trash2 color={t.pitanga600} size={20} />
          <Text className="font-display text-lg font-bold text-pitanga-600">Excluir Personal</Text>
        </View>
        <Text className="mb-3 text-sm text-muted">
          Apaga a conta, os vínculos, convites, aulas e relatórios dele. <Text className="text-sm font-bold">Os alunos continuam</Text> com o histórico e as fichas, e são avisados. Não dá para desfazer.
        </Text>
        <DeletePersonalForm id={p.id} />
      </Card>
    </Screen>
  );
}
