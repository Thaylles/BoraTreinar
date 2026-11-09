import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { ChevronRight, Dumbbell, Play } from "lucide-react-native";
import { getWeighInStatus, listWeights } from "@/lib/weight-server";
import { loadAgenda } from "@/lib/agenda-server";
import { loadRunnerForPlan, loadRunnerForTemplate } from "@/lib/runner-server";
import { addMonths, classEnd, classInProgress, dayLabel, MONTHS, nextPlan } from "@/lib/schedule";
import { spDateKey, spTimeKey } from "@/lib/week";
import { suggestedGoal } from "@/lib/water";
import { firstName } from "@/lib/format";
import { useData, useRefresh } from "~/lib/data";
import { queryClient } from "~/lib/query";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Alert, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Gradient, ShortcutCard } from "~/ui/extras";
import { AchievementsCard, CardioGoalCard, LinkRequestsCard, NotificationsList, WaterCard, WeeklyGoal } from "~/components/widgets";
import { OpenWorkouts, PendingSync } from "~/components/open-workouts";
import { NotificationsCard } from "~/components/device-notifications";

async function loadHome(id: string, coach: boolean) {
  const [weighIn, agenda, lastWeight, plans, personals, requests, achievements, templates, health, recent] = await Promise.all([
    getWeighInStatus(id),
    loadAgenda({ studentId: id, days: 7 }),
    listWeights(id, 1),
    supabase.from("workout_plans").select("id, name, goal, created_by, items:workout_plan_items(count)").eq("student_id", id).is("archived_at", null).order("name"),
    supabase.from("personal_students").select("id", { count: "exact", head: true }).eq("student_id", id).eq("status", "ativo"),
    supabase.from("link_requests").select("id, personal:profiles!link_requests_personal_id_fkey(full_name, avatar_path)").eq("student_id", id).eq("status", "pendente"),
    supabase.rpc("my_achievements", {}),
    coach
      ? supabase.from("workout_plans").select("id, name, goal, items:workout_plan_items(count)").eq("is_template", true).eq("created_by", id).is("archived_at", null).order("name")
      : Promise.resolve({ data: null }),
    supabase.from("health_forms").select("parq_yes, clearance_path").eq("student_id", id).maybeSingle(),
    supabase.from("workout_sessions").select("plan_id, started_at").eq("student_id", id).not("plan_id", "is", null).order("started_at", { ascending: false }).limit(200),
  ]);
  return {
    weighIn,
    agenda,
    lastWeight: lastWeight[0]?.weight_kg ?? null,
    plans: plans.data ?? [],
    personals: personals.count ?? 0,
    requests: requests.data ?? [],
    achievements: achievements.data ?? [],
    templates: templates.data ?? [],
    health: health.data,
    recent: recent.data ?? [],
  };
}

export default function AlunoHome() {
  const profile = useProfile();
  const coach = profile.role === "personal";
  const sp = useLocalSearchParams<{ bemvindo?: string; prontos?: string }>();
  const t = useTheme();
  const q = useData(["aluno-home", profile.id], () => loadHome(profile.id, coach));
  const refresh = useRefresh(q);

  // Deixa todas as fichas prontas no aparelho: dá para treinar mesmo sem internet na academia.
  const planIds = (q.data?.plans ?? []).map((p) => p.id).join(",");
  const templateIds = (q.data?.templates ?? []).map((p) => p.id).join(",");
  useEffect(() => {
    for (const id of planIds.split(",").filter(Boolean))
      void queryClient.prefetchQuery({
        queryKey: ["runner", "plan", id, profile.id],
        queryFn: async () => {
          const d = await loadRunnerForPlan(id, profile.id);
          return d && { name: d.plan.name, planId: id, exercises: d.exercises };
        },
        staleTime: 1000 * 60 * 30,
      });
    for (const id of templateIds.split(",").filter(Boolean))
      void queryClient.prefetchQuery({
        queryKey: ["runner", "template", id, profile.id],
        queryFn: async () => {
          const d = await loadRunnerForTemplate(id, profile.id);
          return d && { name: d.plan.name, planId: null, exercises: d.exercises };
        },
        staleTime: 1000 * 60 * 30,
      });
  }, [planIds, templateIds, profile.id]);

  if (!q.data) return <Loading />;
  const { weighIn, agenda, plans, personals, requests, achievements, templates, health, recent } = q.data;
  const liveClass = classInProgress(agenda.occurrences, agenda.today, spTimeKey());
  const nextClass = agenda.occurrences.find((o) => !o.cancelled && o !== liveClass);
  const lastTrained = new Map<string, string>();
  for (const r of recent) if (r.plan_id && !lastTrained.has(r.plan_id)) lastTrained.set(r.plan_id, r.started_at);
  const suggested = nextPlan(plans, lastTrained);
  const startHref = suggested ? (`/aluno/treinar/${suggested.id}` as const) : ("/aluno/livre" as const);
  const todayKey = spDateKey();
  const recapMonth = addMonths(todayKey.slice(0, 7), -1);
  const monthRecap =
    Number(todayKey.slice(8)) <= 7 && recent.some((r) => spDateKey(r.started_at).startsWith(recapMonth))
      ? { month: recapMonth, name: MONTHS[Number(recapMonth.slice(5)) - 1].toLowerCase() }
      : null;

  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Partiu treino?">E aí, {firstName(profile.full_name)}! 💪</PageTitle>

      {sp.prontos !== undefined ? (
        <Alert kind="success" className="mb-4">
          {Number(sp.prontos) > 0
            ? `Pronto! ${sp.prontos} treinos viraram fichas suas. Comece pelo primeiro e ajuste as cargas do seu jeito. 💪`
            : "Esses treinos já estão nas suas fichas."}
        </Alert>
      ) : null}
      {sp.bemvindo === "1" ? (
        <Alert kind="success" className="mb-4">
          Conta criada! Você já está vinculado ao seu Personal. Bem-vindo ao BoraTreinar! 🇧🇷
        </Alert>
      ) : null}

      <PendingSync />
      <OpenWorkouts prefixes={[`bt:treino:${profile.id}:`, `bt:livre:${profile.id}:`]} />

      {!coach ? (
        <Gradient tone={liveClass ? "anil" : "bandeira"} className="mb-6">
          <View className="p-5">
            {liveClass ? (
              <View className="mb-2 flex-row items-center gap-2">
                <View className="size-3 rounded-full bg-ipe-500" />
                <Text className="flex-1 text-sm font-bold text-ipe-400">
                  Aula com {liveClass.schedule.personal?.full_name?.split(" ")[0] ?? "seu Personal"} agora · {liveClass.time}–{classEnd(liveClass)}
                </Text>
              </View>
            ) : null}
            <Text className="font-display text-2xl font-extrabold leading-tight text-white">
              {liveClass ? "Bora registrar o início do treino?" : "Registrar treino de hoje"}
            </Text>
            <Text className="mt-1 text-sm text-white/85">
              {suggested
                ? `Sugestão: ${suggested.name}${lastTrained.has(suggested.id) ? " (a que está há mais tempo sem treinar)" : ""}.`
                : "Monte o treino na hora com exercícios do catálogo."}
            </Text>
            <Link href={startHref} asChild>
              <Pressable className={cn("mt-4 flex-row items-center justify-center gap-2 rounded-2xl py-4 active:opacity-90", liveClass ? "bg-ipe-500" : "bg-white")}>
                <Play color={liveClass ? t.anil900 : t.bandeira700} fill={liveClass ? t.anil900 : t.bandeira700} size={24} />
                <Text className={cn("flex-shrink text-center font-display text-xl font-extrabold", liveClass ? "text-anil-900" : "text-bandeira-700")}>
                  {liveClass ? "Registrar início do treino" : suggested ? `Começar ${suggested.name}` : "Começar treino livre"}
                </Text>
              </Pressable>
            </Link>
            <View className="mt-3 flex-row flex-wrap justify-center gap-x-4 gap-y-1">
              <Link href="/aluno/registrar-passado">
                <Text className="text-sm font-semibold text-white/90">Esqueceu de registrar um treino?</Text>
              </Link>
            </View>
          </View>
        </Gradient>
      ) : null}

      {monthRecap ? (
        <ShortcutCard
          href={`/aluno/resumo?mes=${monthRecap.month}`}
          emoji="📊"
          title={`Seu resumo de ${monthRecap.name} chegou`}
          sub="Treinos, recordes e frequência do mês, prontos para compartilhar."
          className="border-2 border-anil-500/40"
        />
      ) : null}

      <LinkRequestsCard requests={requests} />

      {!coach && !personals && !requests.length ? (
        <ShortcutCard
          href="/aluno/encontrar"
          emoji="🏋️"
          title="Encontre um Personal"
          sub="Opcional, mas com acompanhamento seus treinos rendem muito mais. Veja fotos, valores e chame no WhatsApp."
          className="border-2 border-dashed border-bandeira-500 bg-transparent"
        />
      ) : null}
      {!coach && !health ? (
        <ShortcutCard
          href="/aluno/saude"
          emoji="🩺"
          title="Preencha sua anamnese"
          sub="Leva 2 minutos: dores, lesões e saúde, para seu Personal montar treinos seguros."
          className="border-2 border-pitanga-500/60 bg-pitanga-100/50 dark:bg-pitanga-500/10"
        />
      ) : null}
      {!coach && health && health.parq_yes.length > 0 && !health.clearance_path ? (
        <ShortcutCard
          href="/aluno/saude"
          emoji="📄"
          title="Envie sua liberação médica"
          sub="Pela sua anamnese, é importante ter o ok do médico antes de intensificar os treinos."
          className="border-2 border-ipe-500 bg-ipe-100 dark:bg-ipe-500/15"
          titleClassName="text-anil-900 dark:text-ipe-400"
          subClassName="text-anil-900 dark:text-ipe-400"
        />
      ) : null}

      <NotificationsCard />
      <WaterCard userId={profile.id} suggestion={suggestedGoal(q.data.lastWeight)} />

      {weighIn.overdue ? (
        <ShortcutCard
          href="/aluno/peso"
          emoji="⚖️"
          title="Pesagem vencida. Registre seu peso para liberar os treinos."
          className="rounded-2xl border-0 bg-ipe-500"
          titleClassName="font-sans text-base font-semibold text-anil-900"
        />
      ) : null}

      <WeeklyGoal studentId={profile.id} />
      <CardioGoalCard studentId={profile.id} canEdit audience="aluno" />
      <AchievementsCard rows={achievements} href="/aluno/conquistas" />

      {coach ? (
        <View className="mb-8">
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <Text className="font-display text-xl font-bold">Treinar com um modelo</Text>
            <Link href="/personal/modelos">
              <Text className="text-sm font-semibold text-bandeira-600 dark:text-bandeira-100">Editar modelos</Text>
            </Link>
          </View>
          {templates.length ? (
            <View className="gap-2">
              {templates.map((tp) => (
                <Link key={tp.id} href={`/aluno/treinar/modelo/${tp.id}`} asChild>
                  <Pressable>
                    <Gradient tone="anil">
                      <View className="flex-row items-center gap-3 p-4">
                        <Dumbbell color={t.ipe400} size={32} />
                        <View className="min-w-0 flex-1">
                          <Text className="font-display text-lg font-bold leading-tight text-white">{tp.name}</Text>
                          <Text className="text-sm text-white/85">
                            {tp.items[0]?.count ?? 0} exercícios{tp.goal ? ` · ${tp.goal}` : ""}
                          </Text>
                        </View>
                        <View className="rounded-full bg-ipe-500 px-3 py-1">
                          <Text className="text-sm font-bold text-anil-900">Treinar</Text>
                        </View>
                      </View>
                    </Gradient>
                  </Pressable>
                </Link>
              ))}
            </View>
          ) : (
            <ShortcutCard
              href="/personal/modelos"
              emoji="🏋️"
              title="Monte um modelo de treino"
              sub="Monte um modelo em Modelos e ele aparece aqui para você treinar. Ou use o treino livre abaixo."
              className="border-2 border-dashed bg-transparent"
            />
          )}
        </View>
      ) : plans.length ? (
        <View className="mb-8">
          <Text className="mb-3 font-display text-xl font-bold">Suas fichas</Text>
          <View className="gap-2">
            {plans.map((p) => (
              <View key={p.id} className="flex-row items-stretch gap-2">
                <Link href={`/aluno/fichas/${p.id}`} asChild>
                  <Pressable className="min-w-0 flex-1">
                    <Gradient className="flex-1">
                      <View className="flex-row items-center gap-3 p-4">
                        <Dumbbell color={t.ipe400} size={32} />
                        <View className="min-w-0 flex-1">
                          <Text className="font-display text-lg font-bold leading-tight text-white">{p.name}</Text>
                          <Text className="text-sm text-white/85">
                            {p.items[0]?.count ?? 0} {p.items[0]?.count === 1 ? "exercício" : "exercícios"}
                            {p.goal ? ` · ${p.goal}` : ""}
                            {p.created_by === profile.id ? " · criada por você" : ""}
                          </Text>
                        </View>
                        <ChevronRight color="#fff" size={20} />
                      </View>
                    </Gradient>
                  </Pressable>
                </Link>
                <Link href={`/aluno/treinar/${p.id}`} asChild>
                  <Pressable accessibilityLabel={`Treinar ${p.name}`} className="w-20 items-center justify-center gap-1 rounded-3xl bg-ipe-500 active:opacity-80">
                    <Play color={t.anil900} fill={t.anil900} size={24} />
                    <Text className="font-display text-sm font-extrabold text-anil-900">Treinar</Text>
                  </Pressable>
                </Link>
              </View>
            ))}
          </View>
          <NewPlanLink />
          {!personals ? <StarterLink /> : null}
        </View>
      ) : (
        <>
          <Gradient className="mb-3">
            <View className="flex-row items-center gap-4 p-5">
              <Dumbbell color={t.ipe400} size={40} />
              <View className="flex-1">
                <Text className="font-display text-xl font-bold text-white">Seus treinos aparecem aqui</Text>
                <Text className="text-sm text-white/85">
                  {personals
                    ? "Assim que seu Personal montar suas fichas, é só escolher a do dia e mandar ver."
                    : "Sem Personal? Monte suas próprias fichas, use o treino livre ou encontre um Personal."}
                </Text>
              </View>
            </View>
          </Gradient>
          <View className="mb-8">
            {!personals ? <StarterLink highlight /> : null}
            <NewPlanLink />
          </View>
        </>
      )}

      {nextClass ? (
        <Link href="/aluno/aulas" asChild>
          <Pressable className="mb-4 flex-row items-center gap-3 rounded-3xl bg-anil-700 p-4 active:opacity-90">
            <Text className="text-2xl">📅</Text>
            <View className="flex-1">
              <Text className="text-xs uppercase tracking-wide text-white/70">Próxima aula com seu Personal</Text>
              <Text className="font-display text-lg font-bold text-white">
                {dayLabel(nextClass.date, agenda.today)} às {nextClass.time}
              </Text>
            </View>
            <ChevronRight color="#fff" size={20} />
          </Pressable>
        </Link>
      ) : null}

      <ShortcutCard
        href="/aluno/livre"
        emoji="🏋️"
        title="Treino livre"
        sub="Monte o treino de hoje com exercícios do catálogo."
        className="mb-8 border-2 border-dashed border-bandeira-500/50 bg-transparent"
        titleClassName="text-lg"
      />
      <ShortcutCard href="/como-usar" emoji="🎬" title="Como usar o app" sub="Vídeos curtos e narrados mostrando o passo a passo." className="mb-6" titleClassName="text-lg" />

      {!coach ? <NotificationsList /> : null}
    </Screen>
  );
}

function NewPlanLink() {
  return (
    <Link href="/aluno/fichas/nova" asChild>
      <Pressable className="mt-2 items-center rounded-2xl border-2 border-dashed border-bandeira-500/50 py-3 active:bg-bandeira-50">
        <Text className="font-display font-bold text-bandeira-600 dark:text-bandeira-100">+ Criar minha ficha</Text>
      </Pressable>
    </Link>
  );
}

function StarterLink({ highlight }: { highlight?: boolean }) {
  return (
    <ShortcutCard
      href="/aluno/treinos-prontos"
      emoji="📚"
      title={highlight ? "Começando agora? Use treinos prontos" : "Treinos prontos por nível"}
      sub="4 treinos para iniciante, intermediário ou avançado. Viram fichas suas na hora."
      className={cn("mb-0 mt-2", highlight ? "border-2 border-ipe-500 bg-ipe-100 dark:bg-ipe-500/15" : "border-2 border-dashed bg-transparent")}
      titleClassName={highlight ? "text-anil-900 dark:text-ipe-400" : undefined}
      subClassName={highlight ? "text-anil-900 dark:text-ipe-400" : undefined}
    />
  );
}

