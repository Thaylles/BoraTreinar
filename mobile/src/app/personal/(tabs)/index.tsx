import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { CalendarDays, ClipboardList, Dumbbell, FileBarChart, Inbox, Ticket, UserPlus, Users } from "lucide-react-native";
import { listWeights } from "@/lib/weight-server";
import { loadOpenRequests } from "@/lib/exercise-requests-server";
import { suggestedGoal } from "@/lib/water";
import { firstName } from "@/lib/format";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Card, LinkButton, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { ShortcutCard } from "~/ui/extras";
import { AchievementsCard, NotificationsList, WaterCard } from "~/components/widgets";
import { OpenWorkouts, PendingSync } from "~/components/open-workouts";
import { NotificationsCard } from "~/components/device-notifications";
import { PersonalOverview } from "~/components/personal-overview";

export default function PersonalHome() {
  const profile = useProfile();
  const t = useTheme();
  const q = useData(["personal-home", profile.id], async () => {
    const nowIso = new Date().toISOString();
    const [students, invites, requests, achievements, lastWeight, open] = await Promise.all([
      supabase.from("personal_students").select("id", { count: "exact", head: true }).eq("personal_id", profile.id).eq("status", "ativo").is("archived_at", null),
      supabase.from("invites").select("id", { count: "exact", head: true }).is("used_at", null).is("revoked_at", null).gt("expires_at", nowIso),
      supabase.from("student_transfers").select("id", { count: "exact", head: true }).eq("to_personal_id", profile.id).eq("status", "pendente"),
      supabase.rpc("my_achievements", { p_audience: "personal" }),
      listWeights(profile.id, 1),
      loadOpenRequests(),
    ]);
    return { students: students.count ?? 0, invites: invites.count ?? 0, requests: requests.count ?? 0, achievements: achievements.data ?? [], lastWeight: lastWeight[0]?.weight_kg ?? null, open };
  });
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  const d = q.data;
  const stats = [
    { href: "/personal/alunos" as const, label: "Alunos ativos", value: d.students, icon: Users },
    { href: "/personal/convites" as const, label: "Convites abertos", value: d.invites, icon: Ticket },
    { href: "/personal/solicitacoes" as const, label: "Pedidos", value: d.requests, icon: Inbox },
  ];
  const missing = [!profile.birth_date && "sua data de nascimento", !profile.service_cities?.length && "as cidades onde você atende"].filter(Boolean).join(" e ");
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Bora acompanhar a galera?">Fala, {firstName(profile.full_name)}! 👋</PageTitle>
      <PendingSync />
      <OpenWorkouts prefixes={[`bt:registro:${profile.id}:`, `bt:treino:${profile.id}:`, `bt:livre:${profile.id}:`]} />
      <NotificationsCard />
      <WaterCard userId={profile.id} suggestion={suggestedGoal(d.lastWeight)} />
      {d.open.length ? (
        <ShortcutCard
          href="/personal/exercicios/pedidos"
          emoji="💡"
          title={d.open.length === 1 ? "1 exercício pedido pelos alunos" : `${d.open.length} exercícios pedidos pelos alunos`}
          sub={`${d.open.slice(0, 3).map((r) => r.name).join(", ")}${d.open.length > 3 ? "…" : ""} · Adicione ao catálogo para todos usarem.`}
          className="border-2 border-ipe-500"
        />
      ) : null}
      {missing ? (
        <ShortcutCard
          href="/personal/perfil"
          emoji="📍"
          title="Complete seu perfil para novos alunos"
          sub={`${missing.replace(/^./, (c) => c.toUpperCase())}: é assim que alunos da sua região te encontram.`}
          className="border-2 border-dashed border-bandeira-500"
        />
      ) : null}
      {!profile.logo_path ? (
        <ShortcutCard
          href="/personal/perfil"
          emoji="✨"
          title="Sua marca no app dos alunos · PREMIUM"
          sub="Coloque seu logo no topo do app dos seus alunos. Teste grátis por tempo limitado: experimente agora!"
          className="border-2 border-ipe-500 bg-ipe-100/60 dark:bg-ipe-500/10"
        />
      ) : null}
      <View className="mb-6 flex-row gap-3">
        {stats.map(({ href, label, value, icon: Icon }) => (
          <Link key={href} href={href} asChild>
            <Pressable className="flex-1">
              <Card className="p-4">
                <Icon color={t.bandeira500} size={20} />
                <Text className="mt-2 font-display text-3xl font-extrabold leading-none">{value}</Text>
                <Text className="mt-1 text-xs text-muted">{label}</Text>
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>
      <LinkButton href="/personal/convites" size="lg" icon={UserPlus} className="mb-3">
        Convidar aluno
      </LinkButton>
      <View className="mb-8 flex-row gap-2">
        {[
          { href: "/personal/agenda" as const, label: "Agenda", icon: CalendarDays },
          { href: "/personal/relatorios" as const, label: "Relatórios", icon: FileBarChart },
          { href: "/personal/modelos" as const, label: "Modelos", icon: ClipboardList },
          { href: "/personal/exercicios" as const, label: "Exercícios", icon: Dumbbell },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} asChild>
            <Pressable className="flex-1 items-center gap-1 rounded-2xl border-2 border-anil-700 py-3 dark:border-ipe-500">
              <Icon color={t.dark ? t.ipe500 : t.anil700} size={20} />
              <Text className="text-xs font-bold text-anil-700 dark:text-ipe-500">{label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
      <AchievementsCard rows={d.achievements} href="/personal/conquistas" />
      <ShortcutCard href="/aluno" emoji="🏋️" title="Meu treino" sub="Bora treinar também? Use seus modelos ou o treino livre, com histórico, evolução e conquistas." className="mb-6 border-0 bg-bandeira-600" titleClassName="text-lg text-white" subClassName="text-white/85" />
      <PersonalOverview personalId={profile.id} />
      <ShortcutCard href="/como-usar" emoji="🎬" title="Como usar o app" sub="Vídeos curtos e narrados mostrando o passo a passo." className="mb-6" titleClassName="text-lg" />
      <NotificationsList />
    </Screen>
  );
}
