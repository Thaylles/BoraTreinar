import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Badge, Card, PageTitle } from "@/components/ui/card";
import { AdminProfileForm } from "@/components/admin/profile-form";
import { requireAdmin } from "@/lib/admin-server";
import { formatDate } from "@/lib/format";
import { formatPhoneBR } from "@/lib/phone";
import { daysAgoLabel, daysAgoSP, startOfWeekSP } from "@/lib/week";

export const metadata: Metadata = { title: "Aluno · Admin" };

export default async function AdminAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const { data: s } = await db.from("profiles").select("*").eq("id", id).eq("role", "aluno").maybeSingle();
  if (!s) notFound();

  const [{ data: links }, total, week, plans, { data: last }, { data: settings }] = await Promise.all([
    db
      .from("personal_students")
      .select("role, status, created_at, personal:profiles!personal_students_personal_id_fkey(id, full_name, email)")
      .eq("student_id", id)
      .order("created_at"),
    db.from("workout_sessions").select("id", { count: "exact", head: true }).eq("student_id", id),
    db.from("workout_sessions").select("id", { count: "exact", head: true }).eq("student_id", id).gte("started_at", startOfWeekSP()),
    db.from("workout_plans").select("id", { count: "exact", head: true }).eq("student_id", id).is("archived_at", null),
    db.from("workout_sessions").select("started_at").eq("student_id", id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("student_settings").select("weight_visible_to_personal, weigh_in_frequency").eq("student_id", id).maybeSingle(),
  ]);

  const stats = [
    { label: "Treinos no total", value: total.count ?? 0 },
    { label: "Treinos na semana", value: week.count ?? 0 },
    { label: "Fichas ativas", value: plans.count ?? 0 },
  ];

  return (
    <>
      <Link href="/admin/alunos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Alunos
      </Link>
      <PageTitle sub={`${s.email} · ${formatPhoneBR(s.phone) || "sem telefone"} · desde ${formatDate(s.created_at)}`}>{s.full_name}</PageTitle>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {stats.map((x) => (
          <Card key={x.label} className="p-3">
            <p className="font-display text-2xl font-extrabold tabular-nums">{x.value}</p>
            <p className="text-xs text-muted">{x.label}</p>
          </Card>
        ))}
      </div>
      <p className="mb-6 text-sm text-muted">
        Último treino: {last ? daysAgoLabel(daysAgoSP(last.started_at)) : "nunca"} · Pesagem {settings?.weigh_in_frequency ?? "semanal"} · Peso{" "}
        {settings?.weight_visible_to_personal ? "visível" : "oculto"} para os Personais
      </p>

      <section className="mb-6">
        <h2 className="mb-2 font-display text-xl font-bold">Personais</h2>
        {links?.length ? (
          <ul className="space-y-2">
            {links.map((l) => (
              <li key={l.personal?.id}>
                <Link
                  href={`/admin/personais/${l.personal?.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-sm transition hover:border-bandeira-500"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{l.personal?.full_name}</span>
                    <span className="block truncate text-xs text-muted">{l.personal?.email}</span>
                  </span>
                  <Badge tone={l.role === "responsavel" ? "green" : "blue"}>{l.role === "responsavel" ? "Responsável" : "Compartilhado"}</Badge>
                  {l.status !== "ativo" && <Badge tone="red">{l.status}</Badge>}
                  <ChevronRight className="size-4 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sem Personal vinculado.</p>
        )}
      </section>

      <Card>
        <h2 className="mb-3 font-display text-lg font-bold">Dados de cadastro</h2>
        <AdminProfileForm profile={s} />
      </Card>
    </>
  );
}
