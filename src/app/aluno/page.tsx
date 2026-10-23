import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Dumbbell, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWeighInStatus } from "@/lib/weight-server";
import { loadAgenda } from "@/lib/agenda-server";
import { classEnd, classInProgress, dayLabel, nextPlan } from "@/lib/schedule";
import { spTimeKey } from "@/lib/week";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/alert";
import { Card, PageTitle } from "@/components/ui/card";
import { NotificationsList } from "@/components/notifications";
import { requireRole } from "@/lib/auth";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { PushToggle } from "@/components/pwa/push-toggle";
import { firstName } from "@/lib/format";
import { WeeklyGoal } from "@/components/weekly-goal";
import { LinkRequestsCard } from "@/components/link-requests-card";
import { AchievementsCard } from "@/components/achievements/achievements-card";
import { CardioGoalCard } from "@/components/cardio/cardio-goal-card";

export const metadata: Metadata = { title: "Início" };

export default async function AlunoHome({
  searchParams,
}: {
  searchParams: Promise<{ bemvindo?: string }>;
}) {
  const { profile } = await requireRole("aluno");
  // Personal no "Meu treino": treina com os próprios modelos; não procura Personal.
  const coach = profile.role === "personal";
  const welcome = (await searchParams).bemvindo === "1";
  const supabase = await createClient();
  const [weighIn, agenda] = await Promise.all([getWeighInStatus(profile.id), loadAgenda({ studentId: profile.id, days: 7 })]);
  const liveClass = classInProgress(agenda.occurrences, agenda.today, spTimeKey());
  const nextClass = agenda.occurrences.find((o) => !o.cancelled && o !== liveClass);
  const [
    { data: plans },
    { count: personals },
    { data: requests },
    { data: achievements },
    { data: templates },
    { data: health },
    { data: recent },
  ] = await Promise.all([
    supabase
      .from("workout_plans")
      .select("id, name, goal, created_by, items:workout_plan_items(count)")
      .eq("student_id", profile.id)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("personal_students")
      .select("id", { count: "exact", head: true })
      .eq("student_id", profile.id)
      .eq("status", "ativo"),
    supabase
      .from("link_requests")
      .select("id, personal:profiles!link_requests_personal_id_fkey(full_name, avatar_path)")
      .eq("student_id", profile.id)
      .eq("status", "pendente"),
    supabase.rpc("my_achievements", {}),
    coach
      ? supabase
          .from("workout_plans")
          .select("id, name, goal, items:workout_plan_items(count)")
          .eq("is_template", true)
          .eq("created_by", profile.id)
          .is("archived_at", null)
          .order("name")
      : Promise.resolve({ data: null }),
    supabase.from("health_forms").select("parq_yes, clearance_path").eq("student_id", profile.id).maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("plan_id, started_at")
      .eq("student_id", profile.id)
      .not("plan_id", "is", null)
      .order("started_at", { ascending: false })
      .limit(200),
  ]);
  // Ficha sugerida: a que está há mais tempo sem treinar.
  const lastTrained = new Map<string, string>();
  for (const r of recent ?? []) if (r.plan_id && !lastTrained.has(r.plan_id)) lastTrained.set(r.plan_id, r.started_at);
  const suggested = nextPlan(plans ?? [], lastTrained);
  const startHref = suggested ? `/aluno/treinar/${suggested.id}` : "/aluno/livre";

  return (
    <>
      <PageTitle sub="Partiu treino?">E aí, {firstName(profile.full_name)}! 💪</PageTitle>

      {welcome && (
        <Alert kind="success" className="mb-4">
          Conta criada! Você já está vinculado ao seu Personal. Bem-vindo ao BoraTreinar! 🇧🇷
        </Alert>
      )}

      {!coach && (
        <section
          aria-label="Registrar treino"
          className={cn(
            "mb-6 rounded-3xl p-5 text-white shadow-lg",
            liveClass ? "bg-gradient-to-br from-anil-700 to-anil-900" : "bg-gradient-to-br from-bandeira-500 to-bandeira-700",
          )}
        >
          {liveClass && (
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ipe-400">
              <span className="relative flex size-3" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ipe-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-ipe-500" />
              </span>
              Aula com {liveClass.schedule.personal?.full_name?.split(" ")[0] ?? "seu Personal"} agora · {liveClass.time}–{classEnd(liveClass)}
            </p>
          )}
          <p className="font-display text-2xl font-extrabold leading-tight">
            {liveClass ? "Bora registrar o início do treino?" : "Registrar treino de hoje"}
          </p>
          <p className="mt-1 text-sm text-white/85">
            {suggested
              ? `Sugestão: ${suggested.name}${lastTrained.has(suggested.id) ? " (a que está há mais tempo sem treinar)" : ""}.`
              : "Monte o treino na hora com exercícios do catálogo."}
          </p>
          <Link
            href={startHref}
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-xl font-extrabold shadow-md transition hover:brightness-105 active:scale-[0.99]",
              liveClass ? "bg-ipe-500 text-anil-900" : "bg-white text-bandeira-700",
            )}
          >
            <Play className="size-6 fill-current" aria-hidden />
            {liveClass ? "Registrar início do treino" : suggested ? `Começar ${suggested.name}` : "Começar treino livre"}
          </Link>
          {(plans?.length ?? 0) > 1 && (
            <a href="#fichas" className="mt-3 block text-center text-sm font-semibold text-white/90 underline-offset-4 hover:underline">
              Escolher outra ficha
            </a>
          )}
        </section>
      )}

      <LinkRequestsCard requests={requests ?? []} />

      {!coach && !personals && !requests?.length && (
        <Link
          href="/aluno/encontrar"
          className="mb-4 flex items-center gap-3 rounded-3xl border-2 border-dashed border-bandeira-500 p-4 transition hover:bg-bandeira-50 dark:hover:bg-bandeira-500/10"
        >
          <span className="text-3xl" aria-hidden>🏋️</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold">Encontre um Personal</span>
            <span className="block text-sm text-muted">
              Opcional, mas com acompanhamento seus treinos rendem muito mais. Veja fotos, valores e chame no WhatsApp.
            </span>
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      )}

      {!coach && !health && (
        <Link
          href="/aluno/saude"
          className="mb-4 flex items-center gap-3 rounded-3xl border-2 border-pitanga-500/60 bg-pitanga-100/50 p-4 transition hover:brightness-95 dark:bg-pitanga-500/10"
        >
          <span className="text-3xl" aria-hidden>🩺</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold">Preencha sua anamnese</span>
            <span className="block text-sm text-muted">Leva 2 minutos: dores, lesões e saúde, para seu Personal montar treinos seguros.</span>
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      )}
      {!coach && health && health.parq_yes.length > 0 && !health.clearance_path && (
        <Link
          href="/aluno/saude"
          className="mb-4 flex items-center gap-3 rounded-3xl border-2 border-ipe-500 bg-ipe-100 p-4 text-anil-900 transition hover:brightness-95 dark:bg-ipe-500/15 dark:text-ipe-400"
        >
          <span className="text-3xl" aria-hidden>📄</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold">Envie sua liberação médica</span>
            <span className="block text-sm">Pela sua anamnese, é importante ter o ok do médico antes de intensificar os treinos.</span>
          </span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}

      <InstallPrompt />
      <PushToggle />

      {weighIn.overdue && (
        <Link
          href="/aluno/peso"
          className="mb-4 flex items-center gap-3 rounded-2xl bg-ipe-500 p-4 font-semibold text-anil-900 shadow-sm"
        >
          <span className="text-2xl" aria-hidden>⚖️</span>
          <span className="flex-1">Pesagem vencida. Registre seu peso para liberar os treinos.</span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}

      <WeeklyGoal studentId={profile.id} />
      <CardioGoalCard studentId={profile.id} canEdit audience="aluno" />
      <AchievementsCard rows={achievements ?? []} href="/aluno/conquistas" />

      {coach && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold">Treinar com um modelo</h2>
            <Link href="/personal/modelos" className="text-sm font-semibold text-bandeira-600 hover:underline dark:text-bandeira-100">
              Editar modelos
            </Link>
          </div>
          {templates?.length ? (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/aluno/treinar/modelo/${t.id}`}
                    className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-anil-700 to-anil-900 p-4 text-white shadow-md transition hover:brightness-110"
                  >
                    <Dumbbell className="size-8 shrink-0 text-ipe-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-bold leading-tight">{t.name}</p>
                      <p className="text-sm text-white/85">
                        {t.items[0]?.count ?? 0} exercícios{t.goal && ` · ${t.goal}`}
                      </p>
                    </div>
                    <span className="rounded-full bg-ipe-500 px-3 py-1 text-sm font-bold text-anil-900">Treinar</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Link
              href="/personal/modelos"
              className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-border p-4 text-sm text-muted transition hover:border-bandeira-500"
            >
              <Dumbbell className="size-6 shrink-0 text-bandeira-500" aria-hidden />
              <span className="flex-1">
                Monte um modelo de treino em <strong className="text-foreground">Modelos</strong> e ele aparece aqui para você treinar. Ou use o treino livre abaixo.
              </span>
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          )}
        </section>
      )}

      {coach ? null : plans?.length ? (
        <section id="fichas" className="mb-8 scroll-mt-4">
          <h2 className="mb-3 font-display text-xl font-bold">Suas fichas</h2>
          <ul className="space-y-2">
            {plans.map((p) => (
              <li key={p.id} className="flex items-stretch gap-2">
                <Link
                  href={`/aluno/fichas/${p.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-3xl bg-gradient-to-br from-bandeira-500 to-bandeira-700 p-4 text-white shadow-md transition hover:brightness-110"
                >
                  <Dumbbell className="size-8 shrink-0 text-ipe-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-bold leading-tight">{p.name}</p>
                    <p className="text-sm text-white/85">
                      {p.items[0]?.count ?? 0} {p.items[0]?.count === 1 ? "exercício" : "exercícios"}
                      {p.goal && ` · ${p.goal}`}
                      {p.created_by === profile.id && " · criada por você"}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
                <Link
                  href={`/aluno/treinar/${p.id}`}
                  aria-label={`Treinar ${p.name}`}
                  className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-3xl bg-ipe-500 font-display font-extrabold text-anil-900 shadow-md transition hover:brightness-105 active:scale-95"
                >
                  <Play className="size-6 fill-current" aria-hidden />
                  <span className="text-sm">Treinar</span>
                </Link>
              </li>
            ))}
          </ul>
          <NewPlanLink />
        </section>
      ) : (
        <>
          <Card className="mb-3 flex items-center gap-4 bg-gradient-to-br from-bandeira-500 to-bandeira-700 text-white">
            <Dumbbell className="size-10 shrink-0 text-ipe-400" aria-hidden />
            <div>
              <p className="font-display text-xl font-bold">Seus treinos aparecem aqui</p>
              <p className="text-sm text-white/85">
                {personals
                  ? "Assim que seu Personal montar suas fichas, é só escolher a do dia e mandar ver."
                  : "Sem Personal? Monte suas próprias fichas, use o treino livre ou encontre um Personal."}
              </p>
            </div>
          </Card>
          <div className="mb-8">
            <NewPlanLink />
          </div>
        </>
      )}

      {nextClass && (
        <Link
          href="/aluno/aulas"
          className="mb-4 flex items-center gap-3 rounded-3xl bg-anil-700 p-4 text-white shadow-md transition hover:brightness-110"
        >
          <span className="text-2xl" aria-hidden>📅</span>
          <span className="flex-1">
            <span className="block text-xs uppercase tracking-wide text-white/70">Próxima aula com seu Personal</span>
            <span className="font-display text-lg font-bold">
              {dayLabel(nextClass.date, agenda.today)} às {nextClass.time}
            </span>
          </span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}

      <Link
        href="/aluno/livre"
        className="mb-8 flex items-center gap-3 rounded-3xl border-2 border-dashed border-bandeira-500/50 p-4 transition hover:bg-bandeira-50 dark:hover:bg-bandeira-500/10"
      >
        <span className="text-2xl" aria-hidden>🏋️</span>
        <span className="flex-1">
          <span className="block font-display text-lg font-bold">Treino livre</span>
          <span className="text-sm text-muted">Monte o treino de hoje com exercícios do catálogo.</span>
        </span>
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </Link>

      <Link
        href="/como-usar"
        className="mb-6 flex items-center gap-3 rounded-3xl border border-border bg-surface p-4 transition hover:border-bandeira-500"
      >
        <span className="text-2xl" aria-hidden>🎬</span>
        <span className="flex-1">
          <span className="block font-display text-lg font-bold">Como usar o app</span>
          <span className="text-sm text-muted">Vídeos curtos e narrados mostrando o passo a passo.</span>
        </span>
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </Link>

      {/* O Personal vê os avisos (dos alunos) no início da área dele. */}
      {!coach && <NotificationsList />}
    </>
  );
}

/** Atalho para o aluno montar uma ficha própria (salva na conta). */
function NewPlanLink() {
  return (
    <Link
      href="/aluno/fichas/nova"
      className="mt-2 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-bandeira-500/50 py-3 font-display font-bold text-bandeira-600 hover:bg-bandeira-50 dark:text-bandeira-100 dark:hover:bg-bandeira-500/10"
    >
      + Criar minha ficha
    </Link>
  );
}
