import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWeighInStatus } from "@/lib/weight-server";
import { loadAgenda } from "@/lib/agenda-server";
import { dayLabel } from "@/lib/schedule";
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
  const nextClass = agenda.occurrences.find((o) => !o.cancelled);
  const [{ data: plans }, { count: personals }, { data: requests }, { data: achievements }, { data: templates }] = await Promise.all([
    supabase
      .from("workout_plans")
      .select("id, name, goal, items:workout_plan_items(count)")
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
  ]);

  return (
    <>
      <PageTitle sub="Partiu treino?">E aí, {firstName(profile.full_name)}! 💪</PageTitle>

      {welcome && (
        <Alert kind="success" className="mb-4">
          Conta criada! Você já está vinculado ao seu Personal. Bem-vindo ao BoraTreinar! 🇧🇷
        </Alert>
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
      <CardioGoalCard studentId={profile.id} canEdit={!personals} audience="aluno" />
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
        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl font-bold">Suas fichas</h2>
          <ul className="space-y-2">
            {plans.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/aluno/fichas/${p.id}`}
                  className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-bandeira-500 to-bandeira-700 p-4 text-white shadow-md transition hover:brightness-110"
                >
                  <Dumbbell className="size-8 shrink-0 text-ipe-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-bold leading-tight">{p.name}</p>
                    <p className="text-sm text-white/85">
                      {p.items[0]?.count ?? 0} exercícios{p.goal && ` · ${p.goal}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Card className="mb-8 flex items-center gap-4 bg-gradient-to-br from-bandeira-500 to-bandeira-700 text-white">
          <Dumbbell className="size-10 shrink-0 text-ipe-400" aria-hidden />
          <div>
            <p className="font-display text-xl font-bold">Seus treinos aparecem aqui</p>
            <p className="text-sm text-white/85">
              {personals
                ? "Assim que seu Personal montar suas fichas, é só escolher a do dia e mandar ver."
                : "Sem Personal? Use o treino livre para registrar seus exercícios, ou encontre um Personal para montar suas fichas."}
            </p>
          </div>
        </Card>
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
