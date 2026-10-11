import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, ChevronRight, ClipboardList, Mail, Phone, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { applyTemplate } from "../../fichas/actions";
import { SessionList } from "@/components/workout/session-list";
import { PersonalWeightSection } from "@/components/weight/personal-weight-section";
import { listSessions } from "@/lib/sessions-server";
import { daysAgoLabel, daysAgoSP, startOfWeekSP } from "@/lib/week";
import { Badge, Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { formatPhoneBR } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { cancelTransfer, revokeShare, setArchived } from "../../actions";
import { TransferForm } from "./transfer-form";

export const metadata: Metadata = { title: "Aluno" };

export default async function AlunoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { profile: me } = await requireRole("personal");
  const supabase = await createClient();

  const [{ data: student }, { data: links }, { data: transfers }, { data: plans }, { data: templates }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).eq("role", "aluno").maybeSingle(),
    supabase
      .from("personal_students")
      .select("personal_id, role, archived_at, created_at, personal:profiles!personal_students_personal_id_fkey(full_name, email)")
      .eq("student_id", id)
      .eq("status", "ativo"),
    supabase
      .from("student_transfers")
      .select("id, kind, created_at, to:profiles!student_transfers_to_personal_id_fkey(full_name)")
      .eq("student_id", id)
      .eq("from_personal_id", me.id)
      .eq("status", "pendente"),
    supabase
      .from("workout_plans")
      .select("id, name, goal, valid_until, archived_at, created_by, creator:profiles!workout_plans_created_by_fkey(full_name), items:workout_plan_items(count)")
      .eq("student_id", id)
      .order("name"),
    supabase.from("workout_plans").select("id, name").eq("is_template", true).eq("created_by", me.id).order("name"),
  ]);
  const sessions = await listSessions(id, 10);
  const weekStart = startOfWeekSP();
  const thisWeek = sessions.filter((s) => s.started_at >= weekStart);
  const activePlans = plans?.filter((p) => !p.archived_at) ?? [];
  const archivedPlans = plans?.filter((p) => p.archived_at) ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const myLink = links?.find((l) => l.personal_id === me.id);
  if (!student || !myLink) notFound();
  const iAmResponsible = myLink.role === "responsavel";

  return (
    <>
      <Link href="/personal/alunos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Alunos
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-bandeira-500 font-display text-3xl font-bold text-white">
          {student.full_name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold leading-tight">{student.full_name}</h1>
          <div className="mt-1 flex flex-wrap gap-2">
            {iAmResponsible ? <Badge tone="green">Você é o responsável</Badge> : <Badge tone="blue">Compartilhado com você</Badge>}
            {myLink.archived_at && <Badge>Arquivado</Badge>}
          </div>
        </div>
      </div>

      {erro && <Alert className="mb-4">{erro}</Alert>}

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold">Fichas</h2>
          <Link
            href={`/personal/alunos/${id}/fichas/nova`}
            className="inline-flex items-center gap-1 rounded-xl bg-bandeira-500 px-3 py-1.5 font-display text-sm font-bold text-white hover:bg-bandeira-600"
          >
            <Plus className="size-4" aria-hidden /> Nova ficha
          </Link>
        </div>
        {!activePlans.length ? (
          <div className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-border p-4 text-sm text-muted">
            <ClipboardList className="size-6 shrink-0 text-bandeira-500" aria-hidden />
            Nenhuma ficha ainda. Monte a primeira ou aplique um modelo.
          </div>
        ) : (
          <ul className="space-y-2">
            {activePlans.map((p) => (
              <li key={p.id}>
                <Link href={`/personal/fichas/${p.id}`}>
                  <Card className="flex items-center gap-3 p-4 transition hover:border-bandeira-500">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted">
                        {p.items[0]?.count ?? 0} exercícios
                        {p.goal && ` · ${p.goal}`} · por {p.created_by === me.id ? "você" : (p.creator?.full_name ?? "—")}
                      </p>
                    </div>
                    {p.valid_until && p.valid_until < today && <Badge tone="red">Vencida</Badge>}
                    <ChevronRight className="size-5 text-muted" aria-hidden />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!!archivedPlans.length && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-muted">{archivedPlans.length} ficha(s) arquivada(s)</summary>
            <ul className="mt-2 space-y-1 pl-4">
              {archivedPlans.map((p) => (
                <li key={p.id}>
                  <Link href={`/personal/fichas/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
        {!!templates?.length && (
          <form action={applyTemplate} className="mt-3 flex gap-2">
            <input type="hidden" name="student_id" value={id} />
            <select name="template_id" required defaultValue="" className={inputClass + " py-2"} aria-label="Modelo">
              <option value="" disabled>
                Aplicar um modelo…
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" size="sm" className="shrink-0">
              Aplicar
            </Button>
          </form>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-1 font-display text-xl font-bold">Treinos</h2>
        <p className="mb-3 text-sm text-muted">
          <strong className="text-foreground">{thisWeek.length}</strong> nesta semana (seg–dom)
          {sessions[0] && ` · último ${daysAgoLabel(daysAgoSP(sessions[0].started_at))}`}
        </p>
        {!!activePlans.length && (
          <div className="mb-3 flex flex-wrap gap-2">
            {activePlans.map((p) => (
              <Link
                key={p.id}
                href={`/personal/alunos/${id}/registrar/${p.id}`}
                className="rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-semibold hover:border-bandeira-500"
              >
                ✍️ Registrar {p.name}
              </Link>
            ))}
          </div>
        )}
        {sessions.length ? (
          <SessionList sessions={sessions} href={(sid) => `/personal/treinos/${sid}`} />
        ) : (
          <p className="text-sm text-muted">Nenhum treino registrado ainda.</p>
        )}
      </section>

      <PersonalWeightSection studentId={id} />

      <Card className="mb-4 space-y-2 text-sm">
        <p className="flex items-center gap-2">
          <Phone className="size-4 text-muted" aria-hidden /> {formatPhoneBR(student.phone) || "Sem telefone"}
        </p>
        <p className="flex items-center gap-2 break-all">
          <Mail className="size-4 text-muted" aria-hidden /> {student.email}
        </p>
        {student.birth_date && (
          <p className="text-muted">Nascimento: {formatDate(`${student.birth_date}T12:00:00`)}</p>
        )}
        <p className="text-muted">Aluno desde {formatDate(myLink.created_at)}</p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 font-display text-lg font-bold">Personais deste aluno</h2>
        <ul className="space-y-2">
          {links?.map((l) => (
            <li key={l.personal_id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-semibold">{l.personal?.full_name}</span>{" "}
                <span className="text-muted">· {l.role === "responsavel" ? "responsável" : "compartilhado"}</span>
              </span>
              {iAmResponsible && l.role === "compartilhado" && (
                <form action={revokeShare}>
                  <input type="hidden" name="student_id" value={id} />
                  <input type="hidden" name="personal_id" value={l.personal_id} />
                  <button className="rounded-xl px-2 py-1 font-semibold text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15">
                    Revogar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {!!transfers?.length && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold">Pedidos aguardando resposta</p>
            {transfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {t.kind === "compartilhamento" ? "Compartilhar" : "Transferir"} com{" "}
                  <strong>{t.to?.full_name}</strong>
                </span>
                <form action={cancelTransfer}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="rounded-xl px-2 py-1 font-semibold text-muted hover:bg-border/50">Cancelar</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      {iAmResponsible && (
        <Card className="mb-4">
          <h2 className="mb-3 font-display text-lg font-bold">Compartilhar ou transferir</h2>
          <TransferForm studentId={id} />
        </Card>
      )}

      <form action={setArchived} className="mt-6">
        <input type="hidden" name="student_id" value={id} />
        <input type="hidden" name="archived" value={myLink.archived_at ? "0" : "1"} />
        <button className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground">
          {myLink.archived_at ? (
            <>
              <ArchiveRestore className="size-4" aria-hidden /> Reativar aluno
            </>
          ) : (
            <>
              <Archive className="size-4" aria-hidden /> Arquivar aluno
            </>
          )}
        </button>
      </form>

      <p className="mt-8 rounded-2xl bg-ipe-100 p-4 text-sm text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400">
        🚧 O dashboard deste aluno chega na etapa 9.
      </p>
    </>
  );
}
