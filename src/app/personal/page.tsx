import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ClipboardList, Dumbbell, Inbox, Ticket, UserPlus, Users } from "lucide-react";
import { Card, PageTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { NotificationsList } from "@/components/notifications";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/format";
import { PersonalOverview } from "@/components/dashboard/personal-overview";

export const metadata: Metadata = { title: "Início" };

export default async function PersonalHome({ searchParams }: { searchParams: Promise<{ visao?: string }> }) {
  const { profile } = await requireRole("personal");
  const kind = (await searchParams).visao === "mes" ? "mes" : "semana";
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [students, invites, requests] = await Promise.all([
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
  ]);

  const stats = [
    { href: "/personal/alunos", label: "Alunos ativos", value: students.count ?? 0, icon: Users },
    { href: "/personal/convites", label: "Convites abertos", value: invites.count ?? 0, icon: Ticket },
    { href: "/personal/solicitacoes", label: "Pedidos", value: requests.count ?? 0, icon: Inbox },
  ];

  return (
    <>
      <PageTitle sub="Bora acompanhar a galera?">Fala, {firstName(profile.full_name)}! 👋</PageTitle>

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
      <div className="mb-8 grid grid-cols-3 gap-2">
        <LinkButton href="/personal/agenda" variant="secondary" size="sm" className="flex-col py-3">
          <CalendarDays className="size-5" aria-hidden /> Agenda
        </LinkButton>
        <LinkButton href="/personal/modelos" variant="secondary" size="sm" className="flex-col py-3">
          <ClipboardList className="size-5" aria-hidden /> Modelos
        </LinkButton>
        <LinkButton href="/personal/exercicios" variant="secondary" size="sm" className="flex-col py-3">
          <Dumbbell className="size-5" aria-hidden /> Exercícios
        </LinkButton>
      </div>

      <PersonalOverview personalId={profile.id} kind={kind} />

      <NotificationsList />
    </>
  );
}
