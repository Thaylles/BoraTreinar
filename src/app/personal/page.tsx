import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, Dumbbell, FileBarChart, Inbox, Ticket, UserPlus, Users } from "lucide-react";
import { Card, PageTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { NotificationsList } from "@/components/notifications";
import { requireRole } from "@/lib/auth";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { PushToggle } from "@/components/pwa/push-toggle";
import { OpenWorkouts } from "@/components/workout/open-workouts";
import { WaterCard } from "@/components/water/water-card";
import { loadWaterToday } from "@/lib/water-server";
import { suggestedGoal } from "@/lib/water";
import { listWeights } from "@/lib/weight-server";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/format";
import { PersonalOverview } from "@/components/dashboard/personal-overview";
import { AchievementsCard } from "@/components/achievements/achievements-card";
import { RequestsBanner } from "@/components/exercise-requests/requests-panel";
import { loadOpenRequests } from "@/lib/exercise-requests-server";

export const metadata: Metadata = { title: "Início" };

export default async function PersonalHome({ searchParams }: { searchParams: Promise<{ visao?: string }> }) {
  const { profile } = await requireRole("personal");
  const kind = (await searchParams).visao === "mes" ? "mes" : "semana";
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [students, invites, requests, achievements, water, lastWeight] = await Promise.all([
    supabase
      .from("personal_students")
      .select("id", { count: "exact", head: true })
      .eq("personal_id", profile.id)
      .eq("status", "ativo")
      .is("archived_at", null),
    supabase
      .from("invites")
      .select("id", { count: "exact", head: true })
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", nowIso),
    supabase
      .from("student_transfers")
      .select("id", { count: "exact", head: true })
      .eq("to_personal_id", profile.id)
      .eq("status", "pendente"),
    supabase.rpc("my_achievements", { p_audience: "personal" }),
    loadWaterToday(profile.id),
    listWeights(profile.id, 1),
  ]);

  const stats = [
    { href: "/personal/alunos", label: "Alunos ativos", value: students.count ?? 0, icon: Users },
    { href: "/personal/convites", label: "Convites abertos", value: invites.count ?? 0, icon: Ticket },
    { href: "/personal/solicitacoes", label: "Pedidos", value: requests.count ?? 0, icon: Inbox },
  ];

  return (
    <>
      <PageTitle sub="Bora acompanhar a galera?">Fala, {firstName(profile.full_name)}! 👋</PageTitle>

      <OpenWorkouts prefixes={[`bt:registro:${profile.id}:`, `bt:treino:${profile.id}:`, `bt:livre:${profile.id}:`]} />
      <InstallPrompt />
      <PushToggle />
      <WaterCard initial={water} suggestion={suggestedGoal(lastWeight[0]?.weight_kg)} />

      <RequestsBanner requests={await loadOpenRequests()} href="/personal/exercicios/pedidos" />

      {(!profile.birth_date || !profile.service_cities?.length) && (
        <Link
          href="/personal/perfil#cidades"
          className="mb-4 flex items-center gap-3 rounded-3xl border-2 border-dashed border-bandeira-500 bg-surface p-4 transition hover:bg-bandeira-50 dark:hover:bg-bandeira-500/10"
        >
          <span className="text-2xl" aria-hidden>📍</span>
          <span className="flex-1 text-sm">
            <span className="block font-display text-base font-bold">Complete seu perfil para novos alunos</span>
            {[!profile.birth_date && "sua data de nascimento", !profile.service_cities?.length && "as cidades onde você atende"]
              .filter(Boolean)
              .join(" e ")
              .replace(/^./, (c) => c.toUpperCase())}
            : é assim que alunos da sua região te encontram.
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      )}
      {!profile.logo_path && (
        <Link
          href="/personal/perfil#marca"
          className="mb-4 flex items-center gap-3 rounded-3xl border-2 border-ipe-500 bg-ipe-100/60 p-4 transition hover:bg-ipe-100 dark:bg-ipe-500/10"
        >
          <span className="text-2xl" aria-hidden>✨</span>
          <span className="flex-1 text-sm">
            <span className="block font-display text-base font-bold">
              Sua marca no app dos alunos{" "}
              <span className="ml-1 rounded-full bg-ipe-500 px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase text-anil-900">Premium</span>
            </span>
            Coloque seu logo no topo do app dos seus alunos. <strong>Teste grátis por tempo limitado</strong>: experimente agora!
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map(({ href, label, value, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="p-4 transition hover:border-bandeira-500">
              <Icon className="mb-2 size-5 text-bandeira-500" aria-hidden />
              <p className="font-display text-3xl font-extrabold leading-none">{value}</p>
              <p className="mt-1 text-xs text-muted">{label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <LinkButton href="/personal/convites" size="lg" className="mb-3 w-full">
        <UserPlus className="size-5" aria-hidden /> Convidar aluno
      </LinkButton>
      <div className="mb-8 grid grid-cols-4 gap-2">
        <LinkButton href="/personal/agenda" variant="secondary" size="sm" className="flex-col py-3">
          <CalendarDays className="size-5" aria-hidden /> Agenda
        </LinkButton>
        <LinkButton href="/personal/relatorios" variant="secondary" size="sm" className="flex-col py-3">
          <FileBarChart className="size-5" aria-hidden /> Relatórios
        </LinkButton>
        <LinkButton href="/personal/modelos" variant="secondary" size="sm" className="flex-col py-3">
          <ClipboardList className="size-5" aria-hidden /> Modelos
        </LinkButton>
        <LinkButton href="/personal/exercicios" variant="secondary" size="sm" className="flex-col py-3">
          <Dumbbell className="size-5" aria-hidden /> Exercícios
        </LinkButton>
      </div>

      <AchievementsCard rows={achievements.data ?? []} href="/personal/conquistas" />

      <Link
        href="/aluno"
        className="mb-6 flex items-center gap-3 rounded-3xl bg-gradient-to-br from-bandeira-500 to-bandeira-700 p-4 text-white shadow-md transition hover:brightness-110"
      >
        <span className="text-3xl" aria-hidden>🏋️</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold">Meu treino</span>
          <span className="block text-sm text-white/85">Bora treinar também? Use seus modelos ou o treino livre, com histórico, evolução e conquistas.</span>
        </span>
        <ChevronRight className="size-5" aria-hidden />
      </Link>

      <PersonalOverview personalId={profile.id} kind={kind} />

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

      <NotificationsList />
    </>
  );
}
