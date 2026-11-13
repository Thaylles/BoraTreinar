import { AppUpdate } from "~/components/app-update";
import { Pressable, View } from "react-native";
import { Link, type Href } from "expo-router";
import { Activity, CalendarDays, ClipboardList, Dumbbell, FileBarChart, Lock, Ticket, UserRound, Users } from "lucide-react-native";
import { formatDate } from "@/lib/format";
import { loadOpenRequests } from "@/lib/exercise-requests-server";
import { adminData } from "~/lib/admin-data";
import { useData, useRefresh } from "~/lib/data";
import { Alert, Card, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { ShortcutCard } from "~/ui/extras";
import { TestEmailCard } from "~/components/admin-forms";

const ROLE_LABEL = { personal: "Personal", aluno: "Aluno", admin: "Admin" } as const;

export default function AdminHome() {
  const t = useTheme();
  const q = useData(["admin-home"], () => adminData("adminHomeData"));
  const open = useData(["exercise-requests-count"], loadOpenRequests);
  const refresh = useRefresh(q, open);
  if (q.isError && !q.data) return <Screen edges={[]}><Alert>{(q.error as Error).message}</Alert></Screen>;
  if (!q.data) return <Loading />;
  const d = q.data;
  const stats: { label: string; value: number; icon: typeof Users; href?: Href }[] = [
    { label: "Personais", value: d.personais, icon: UserRound, href: "/admin/personais" },
    { label: "Alunos", value: d.alunos, icon: Users, href: "/admin/alunos" },
    { label: "Treinos na semana", value: d.treinosSemana, icon: Activity },
    { label: "Treinos em 30 dias", value: d.treinos30, icon: Activity },
    { label: "Fichas ativas", value: d.fichas, icon: ClipboardList },
    { label: "Exercícios de Personais", value: d.exerciciosProprios, icon: Dumbbell, href: "/admin/exercicios?filtro=proprios" },
    { label: "Exercícios travados", value: d.travados, icon: Lock, href: "/admin/exercicios?filtro=travados" },
    { label: "Personais bloqueados", value: d.bloqueados, icon: Lock, href: "/admin/personais?filtro=bloqueados" },
    { label: "Convites abertos", value: d.convites, icon: Ticket },
    { label: "Aulas na agenda", value: d.aulas, icon: CalendarDays },
    { label: "Relatórios gerados", value: d.relatorios, icon: FileBarChart },
  ];
  const requests = open.data ?? [];
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <AppUpdate />
      <PageTitle sub="Visão geral do BoraTreinar.">Painel do admin</PageTitle>
      {requests.length ? (
        <ShortcutCard
          href="/admin/pedidos"
          emoji="💡"
          title={requests.length === 1 ? "1 exercício pedido pelos alunos" : `${requests.length} exercícios pedidos pelos alunos`}
          sub={`${requests.slice(0, 3).map((r) => r.name).join(", ")}${requests.length > 3 ? "…" : ""} · Adicione ao catálogo para todos usarem.`}
          className="border-2 border-ipe-500"
        />
      ) : null}
      <ShortcutCard href="/admin/execucoes" emoji="🎬" title="Execuções dos exercícios" sub="GIFs e vídeos de cada exercício: gerar e aprovar." />
      <ShortcutCard href="/admin/fotos" emoji="📸" title="Fotos com IA" sub="Fotos no estilo do catálogo para exercícios sem imagem." />
      <View className="mb-8 flex-row flex-wrap justify-between gap-y-3">
        {stats.map(({ label, value, icon: Icon, href }) => {
          const body = (
            <Card className="h-full p-4">
              <Icon color={t.bandeira500} size={20} />
              <Text className="mt-2 font-display text-3xl font-extrabold leading-none">{value}</Text>
              <Text className="mt-1 text-xs text-muted">{label}</Text>
            </Card>
          );
          return (
            <View key={label} style={{ width: "48.5%" }}>
              {href ? (
                <Link href={href} asChild>
                  <Pressable>{body}</Pressable>
                </Link>
              ) : (
                body
              )}
            </View>
          );
        })}
      </View>
      <TestEmailCard />
      <Text className="mb-2 font-display text-xl font-bold">Cadastros recentes</Text>
      <View className="gap-2">
        {d.recentes.map((p) => {
          const href = p.role === "personal" ? `/admin/personais/${p.id}` : p.role === "aluno" ? `/admin/alunos/${p.id}` : null;
          const row = (
            <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <Text className="min-w-0 flex-1 text-sm font-semibold" numberOfLines={1}>{p.full_name}</Text>
              <View className="rounded-full bg-border/50 px-2 py-0.5">
                <Text className="text-xs font-bold">{ROLE_LABEL[p.role]}</Text>
              </View>
              <Text className="text-xs text-muted">{formatDate(p.created_at)}</Text>
            </View>
          );
          return href ? (
            <Link key={p.id} href={href as Href} asChild>
              <Pressable>{row}</Pressable>
            </Link>
          ) : (
            <View key={p.id}>{row}</View>
          );
        })}
      </View>
    </Screen>
  );
}
