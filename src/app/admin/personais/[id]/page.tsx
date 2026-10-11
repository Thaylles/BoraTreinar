import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Lock, LockOpen, Trash2 } from "lucide-react";
import { Badge, Card, PageTitle } from "@/components/ui/card";
import { AdminProfileForm } from "@/components/admin/profile-form";
import { DeletePersonalForm } from "@/components/admin/delete-personal-form";
import { adminSetCatalogBlocked } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin-server";
import { formatDate } from "@/lib/format";
import { formatPhoneBR } from "@/lib/phone";
import { daysAgoLabel, daysAgoSP } from "@/lib/week";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Personal · Admin" };

export default async function AdminPersonalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const { data: p } = await db.from("profiles").select("*").eq("id", id).eq("role", "personal").maybeSingle();
  if (!p) notFound();

  const [{ data: links }, plans, exercises, invites, classes] = await Promise.all([
    db
      .from("personal_students")
      .select("role, status, created_at, archived_at, student:profiles!personal_students_student_id_fkey(id, full_name, email, phone)")
      .eq("personal_id", id)
      .order("created_at", { ascending: false }),
    db.from("workout_plans").select("id", { count: "exact", head: true }).eq("created_by", id),
    db.from("equipment").select("id", { count: "exact", head: true }).eq("created_by", id),
    db.from("invites").select("id", { count: "exact", head: true }).eq("personal_id", id).is("used_at", null).is("revoked_at", null),
    db.from("class_schedules").select("id", { count: "exact", head: true }).eq("personal_id", id),
  ]);
  const active = (links ?? []).filter((l) => l.status === "ativo" && l.student);
  const studentIds = active.map((l) => l.student!.id);
  const { data: lastSessions } = studentIds.length
    ? await db.from("workout_sessions").select("student_id, started_at").in("student_id", studentIds).order("started_at", { ascending: false }).limit(1000)
    : { data: [] };
  const lastOf = new Map<string, string>();
  for (const s of lastSessions ?? []) if (!lastOf.has(s.student_id)) lastOf.set(s.student_id, s.started_at);

  const stats = [
    { label: "Alunos ativos", value: active.length },
    { label: "Fichas criadas", value: plans.count ?? 0 },
    { label: "Exercícios próprios", value: exercises.count ?? 0 },
    { label: "Convites abertos", value: invites.count ?? 0 },
    { label: "Aulas na agenda", value: classes.count ?? 0 },
  ];

  return (
    <>
      <Link href="/admin/personais" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Personais
      </Link>
      <PageTitle sub={`${p.email} · ${formatPhoneBR(p.phone) || "sem telefone"} · desde ${formatDate(p.created_at)}`}>{p.full_name}</PageTitle>

      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-3">
            <p className="font-display text-2xl font-extrabold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className={cn("mb-6", p.catalog_blocked && "border-pitanga-500/50")}>
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          {p.catalog_blocked ? <Lock className="size-5 text-pitanga-600" aria-hidden /> : <LockOpen className="size-5 text-bandeira-500" aria-hidden />}
          Edição de exercícios e máquinas
        </h2>
        <p className="mb-3 text-sm text-muted">
          {p.catalog_blocked
            ? "Bloqueado: este Personal não cria, edita, exclui nem troca fotos de exercícios. Ele continua montando fichas com o catálogo."
            : "Liberado: este Personal pode criar e editar os próprios exercícios e trocar fotos do catálogo padrão (exceto os travados)."}
        </p>
        <form action={adminSetCatalogBlocked}>
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="blocked" value={p.catalog_blocked ? "0" : "1"} />
          <button
            className={cn(
              "rounded-2xl px-4 py-2 font-display font-bold text-white",
              p.catalog_blocked ? "bg-bandeira-500 hover:bg-bandeira-600" : "bg-pitanga-500 hover:bg-pitanga-600",
            )}
          >
            {p.catalog_blocked ? "Liberar edição" : "Bloquear edição"}
          </button>
        </form>
      </Card>

      <section className="mb-6">
        <h2 className="mb-2 font-display text-xl font-bold">Alunos ({active.length})</h2>
        {active.length ? (
          <ul className="space-y-2">
            {active.map((l) => {
              const last = lastOf.get(l.student!.id);
              return (
                <li key={l.student!.id}>
                  <Link
                    href={`/admin/alunos/${l.student!.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-sm transition hover:border-bandeira-500"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{l.student!.full_name}</span>
                      <span className="block truncate text-xs text-muted">{l.student!.email}</span>
                    </span>
                    <span className="text-xs text-muted">{last ? `treinou ${daysAgoLabel(daysAgoSP(last))}` : "nunca treinou"}</span>
                    <Badge tone={l.role === "responsavel" ? "green" : "blue"}>{l.role === "responsavel" ? "Responsável" : "Compartilhado"}</Badge>
                    {l.archived_at && <Badge>Arquivado</Badge>}
                    <ChevronRight className="size-4 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhum aluno vinculado.</p>
        )}
      </section>

      <Card className="mb-6">
        <h2 className="mb-3 font-display text-lg font-bold">Dados de cadastro</h2>
        <AdminProfileForm profile={p} />
      </Card>

      <Card className="border-pitanga-500/40">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-pitanga-600">
          <Trash2 className="size-5" aria-hidden /> Excluir Personal
        </h2>
        <p className="mb-3 text-sm text-muted">
          Apaga a conta, os vínculos, convites, aulas e relatórios dele. <strong>Os alunos continuam</strong> com o histórico e as fichas, e são
          avisados. Não dá para desfazer.
        </p>
        <DeletePersonalForm id={p.id} />
      </Card>
    </>
  );
}
