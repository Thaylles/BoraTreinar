import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CalendarDays, ClipboardList, Dumbbell, FileBarChart, Lock, Ticket, UserRound, Users } from "lucide-react";
import { Card, PageTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-server";
import { formatDate } from "@/lib/format";
import { startOfWeekSP } from "@/lib/week";

export const metadata: Metadata = { title: "Admin" };

const ROLE_LABEL = { personal: "Personal", aluno: "Aluno", admin: "Admin" } as const;

export default async function AdminHome() {
  const { db } = await requireAdmin();
  const weekStart = startOfWeekSP();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [personais, alunos, treinosSemana, treinos30, fichas, exerciciosProprios, travados, bloqueados, convites, aulas, relatorios, recentes] =
    await Promise.all([
      count(db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "personal")),
      count(db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "aluno")),
      count(db.from("workout_sessions").select("id", { count: "exact", head: true }).gte("started_at", weekStart)),
      count(db.from("workout_sessions").select("id", { count: "exact", head: true }).gte("started_at", monthAgo)),
      count(db.from("workout_plans").select("id", { count: "exact", head: true }).eq("is_template", false).is("archived_at", null)),
      count(db.from("equipment").select("id", { count: "exact", head: true }).eq("is_default", false)),
      count(db.from("equipment").select("id", { count: "exact", head: true }).eq("locked", true)),
      count(db.from("profiles").select("id", { count: "exact", head: true }).eq("catalog_blocked", true)),
      count(db.from("invites").select("id", { count: "exact", head: true }).is("used_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString())),
      count(db.from("class_schedules").select("id", { count: "exact", head: true })),
      count(db.from("weekly_reports").select("id", { count: "exact", head: true })),
      db.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }).limit(8),
    ]);

  const stats = [
    { label: "Personais", value: personais, icon: UserRound, href: "/admin/personais" },
    { label: "Alunos", value: alunos, icon: Users, href: "/admin/alunos" },
    { label: "Treinos na semana", value: treinosSemana, icon: Activity },
    { label: "Treinos em 30 dias", value: treinos30, icon: Activity },
    { label: "Fichas ativas", value: fichas, icon: ClipboardList },
    { label: "Exercícios de Personais", value: exerciciosProprios, icon: Dumbbell, href: "/admin/exercicios?filtro=proprios" },
    { label: "Exercícios travados", value: travados, icon: Lock, href: "/admin/exercicios?filtro=travados" },
    { label: "Personais bloqueados", value: bloqueados, icon: Lock, href: "/admin/personais?filtro=bloqueados" },
    { label: "Convites abertos", value: convites, icon: Ticket },
    { label: "Aulas na agenda", value: aulas, icon: CalendarDays },
    { label: "Relatórios gerados", value: relatorios, icon: FileBarChart },
  ];

  return (
    <>
      <PageTitle sub="Visão geral do BoraTreinar.">Painel do admin</PageTitle>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, href }) => {
          const body = (
            <Card className="h-full p-4 transition hover:border-bandeira-500">
              <Icon className="mb-2 size-5 text-bandeira-500" aria-hidden />
              <p className="font-display text-3xl font-extrabold leading-none tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-muted">{label}</p>
            </Card>
          );
          return href ? (
            <Link key={label} href={href}>
              {body}
            </Link>
          ) : (
            <div key={label}>{body}</div>
          );
        })}
      </div>

      <h2 className="mb-2 font-display text-xl font-bold">Cadastros recentes</h2>
      <ul className="space-y-2">
        {(recentes.data ?? []).map((p) => {
          const href = p.role === "personal" ? `/admin/personais/${p.id}` : p.role === "aluno" ? `/admin/alunos/${p.id}` : null;
          const row = (
            <span className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-semibold">{p.full_name}</span>
              <span className="rounded-full bg-border/50 px-2 py-0.5 text-xs font-bold">{ROLE_LABEL[p.role]}</span>
              <span className="text-xs text-muted">{formatDate(p.created_at)}</span>
            </span>
          );
          return <li key={p.id}>{href ? <Link href={href}>{row}</Link> : row}</li>;
        })}
      </ul>
    </>
  );
}
