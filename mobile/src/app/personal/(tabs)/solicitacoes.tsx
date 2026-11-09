import { View } from "react-native";
import { Inbox } from "lucide-react-native";
import { formatDate } from "@/lib/format";
import { form } from "~/lib/api";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { useCall } from "~/lib/use-action";
import { Badge, Button, Card, EmptyState, Loading, PageTitle, Screen, Text } from "~/ui";

const STATUS_TONE = { aceito: "green", recusado: "red", cancelado: "neutral", pendente: "yellow" } as const;

export default function Solicitacoes() {
  const profile = useProfile();
  const respond = useCall("personal#respondTransfer");
  const q = useData(["transfers", profile.id], async () =>
    (
      await supabase
        .from("student_transfers")
        .select("id, kind, status, created_at, responded_at, from_personal_id, to_personal_id, student:profiles!student_transfers_student_id_fkey(full_name), from:profiles!student_transfers_from_personal_id_fkey(full_name), to:profiles!student_transfers_to_personal_id_fkey(full_name)")
        .or(`to_personal_id.eq.${profile.id},from_personal_id.eq.${profile.id}`)
        .order("created_at", { ascending: false })
        .limit(50)
    ).data ?? [],
  );
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  const pending = q.data.filter((t) => t.status === "pendente" && t.to_personal_id === profile.id);
  const history = q.data.filter((t) => !pending.includes(t));
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Alunos que outros Personais querem compartilhar ou transferir para você.">Pedidos</PageTitle>
      {!pending.length ? (
        <EmptyState icon={Inbox} title="Nenhum pedido pendente" />
      ) : (
        <View className="gap-3">
          {pending.map((t) => (
            <Card key={t.id}>
              <Badge tone={t.kind === "transferencia" ? "yellow" : "blue"}>{t.kind === "transferencia" ? "Transferência" : "Compartilhamento"}</Badge>
              <Text className="mt-2">
                <Text className="font-bold">{t.from?.full_name}</Text> {t.kind === "transferencia" ? "quer transferir" : "quer compartilhar"} o aluno <Text className="font-bold">{t.student?.full_name ?? "—"}</Text> com você.
              </Text>
              <Text className="mt-1 text-sm text-muted">
                {t.kind === "transferencia" ? "Ao aceitar, você vira o Personal responsável, com acesso a todo o histórico." : "Ao aceitar, você poderá ver fichas, histórico e dashboard, montar fichas e registrar treinos."}
              </Text>
              <View className="mt-4 flex-row gap-2">
                <Button className="flex-1" disabled={respond.pending} onPress={() => respond.run(form({ id: t.id, accept: "1" }))}>
                  Aceitar
                </Button>
                <Button variant="secondary" className="flex-1" disabled={respond.pending} onPress={() => respond.run(form({ id: t.id, accept: "0" }))}>
                  Recusar
                </Button>
              </View>
            </Card>
          ))}
        </View>
      )}
      {history.length ? (
        <>
          <Text className="mb-3 mt-8 font-display text-xl font-bold">Histórico</Text>
          <View className="gap-2">
            {history.map((t) => {
              const sent = t.from_personal_id === profile.id;
              return (
                <View key={t.id} className="flex-row items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-3">
                  <View className="flex-1">
                    <Text className="text-sm">
                      {sent ? `Você → ${t.to?.full_name ?? "—"}` : `${t.from?.full_name ?? "—"} → você`} · {t.kind === "transferencia" ? "transferência" : "compartilhamento"}
                      {t.student?.full_name ? ` de ${t.student.full_name}` : ""}
                    </Text>
                    <Text className="text-xs text-muted">{formatDate(t.created_at)}</Text>
                  </View>
                  <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
