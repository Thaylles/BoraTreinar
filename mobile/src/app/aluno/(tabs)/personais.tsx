import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Mail, ShieldCheck } from "lucide-react-native";
import { formatDate } from "@/lib/format";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Alert, Badge, Card, LinkButton, Loading, PageTitle, Row, Screen, Text, useTheme } from "~/ui";
import { Avatar } from "~/ui/extras";
import { LinkRequestsCard } from "~/components/widgets";

export default function Personais() {
  const profile = useProfile();
  const t = useTheme();
  const { vinculado } = useLocalSearchParams<{ vinculado?: string }>();
  const q = useData(["personais", profile.id], async () => {
    const [{ data: links }, { data: requests }] = await Promise.all([
      supabase.from("personal_students").select("role, created_at, personal:profiles!personal_students_personal_id_fkey(id, full_name, email, avatar_path)").eq("student_id", profile.id).eq("status", "ativo").order("role"),
      supabase.from("link_requests").select("id, personal:profiles!link_requests_personal_id_fkey(full_name, avatar_path)").eq("student_id", profile.id).eq("status", "pendente"),
    ]);
    return { links: links ?? [], requests: requests ?? [] };
  });
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  const { links, requests } = q.data;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Quem acompanha seus treinos.">Meus Personais</PageTitle>
      {vinculado ? <Alert kind="success" className="mb-4">Convite aceito! Agora esse Personal acompanha seus treinos. 💪</Alert> : null}
      <LinkRequestsCard requests={requests} />
      {!links.length ? <Text className="mb-4 text-sm text-muted">Você ainda não tem Personal. Treinar com acompanhamento faz seus resultados aparecerem mais rápido!</Text> : null}
      <View className="gap-3">
        {links.map((l) => (
          <Card key={l.personal?.id} className="flex-row items-center gap-4">
            <Avatar path={l.personal?.avatar_path} name={l.personal?.full_name ?? "?"} size={48} />
            <View className="min-w-0 flex-1">
              <Text className="font-semibold">{l.personal?.full_name}</Text>
              <View className="flex-row items-center gap-1">
                <Mail color={t.muted} size={14} />
                <Text className="text-sm text-muted" numberOfLines={1}>{l.personal?.email}</Text>
              </View>
              <Text className="text-xs text-muted">Desde {formatDate(l.created_at)}</Text>
            </View>
            <Badge tone={l.role === "responsavel" ? "green" : "blue"}>{l.role === "responsavel" ? "Responsável" : "Compartilhado"}</Badge>
          </Card>
        ))}
      </View>
      <LinkButton href="/aluno/encontrar" variant="secondary" className="mt-4">
        Encontrar um Personal
      </LinkButton>
      <Text className="mt-6 text-sm text-muted">Todos os Personais listados aqui podem ver suas fichas e seu histórico de treinos. Seu peso só aparece para eles se você permitir.</Text>
      <Row className="mt-4" href="/aluno/privacidade" left={<ShieldCheck color={t.bandeira500} size={20} />} title="Privacidade e meus dados" right={<Text className="text-xs text-muted">baixar ou excluir</Text>} />
    </Screen>
  );
}
