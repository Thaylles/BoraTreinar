import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { daysAgoLabel, daysAgoSP, startOfWeekSP } from "@/lib/week";
import { Avatar } from "@/components/avatar";
import { AddExistingStudent } from "@/components/add-existing-student";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { cancelLink } from "./vinculo-actions";

export const metadata: Metadata = { title: "Alunos" };

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ arquivados?: string }>;
}) {
  const { profile } = await requireRole("personal");
  const showArchived = (await searchParams).arquivados === "1";
  const supabase = await createClient();

  let query = supabase
    .from("personal_students")
    .select("role, archived_at, student:profiles!personal_students_student_id_fkey(id, full_name, phone, avatar_path)")
    .eq("personal_id", profile.id)
    .eq("status", "ativo");
  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const [{ data: links }, { data: requests }] = await Promise.all([
    query,
    supabase
      .from("link_requests")
      .select("id, student:profiles!link_requests_student_id_fkey(full_name, avatar_path)")
      .eq("personal_id", profile.id)
      .eq("status", "pendente")
      .order("created_at", { ascending: false }),
  ]);

  const ids = (links ?? []).map((l) => l.student?.id).filter((x): x is string => !!x);
  const { data: recent } = ids.length
    ? await supabase
        .from("workout_sessions")
        .select("student_id, started_at")
        .in("student_id", ids)
        .gte("started_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
        .order("started_at", { ascending: false })
    : { data: [] };
  const weekStart = startOfWeekSP();
  const statsFor = (sid: string) => {
    const mine = (recent ?? []).filter((r) => r.student_id === sid);
    return { week: mine.filter((r) => r.started_at >= weekStart).length, last: mine[0]?.started_at ?? null };
  };

  const students = (links ?? [])
    .filter((l) => l.student)
    .sort((a, b) => a.student!.full_name.localeCompare(b.student!.full_name, "pt-BR"));

  return (
    <>
      <PageTitle sub={`${students.length} ${showArchived ? "arquivado(s)" : "ativo(s)"}`}>Alunos</PageTitle>

      {!showArchived && (
        <details className="mb-4 rounded-3xl border border-border bg-surface p-4" open={!!requests?.length}>
          <summary className="cursor-pointer font-display font-bold">+ Adicionar aluno que já tem conta</summary>
          <p className="mb-3 mt-1 text-sm text-muted">
            Busque pelo e-mail ou WhatsApp. O aluno recebe um aviso e confirma no app (sem precisar de link).
          </p>
          <AddExistingStudent />
          {!!requests?.length && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Aguardando o aluno confirmar</p>
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-background p-2">
                    <Avatar path={r.student?.avatar_path} name={r.student?.full_name ?? "?"} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm">{r.student?.full_name}</span>
                    <form action={cancelLink}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmit message="Cancelar o pedido?" className="text-xs font-semibold text-pitanga-600 hover:underline">
                        Cancelar
                      </ConfirmSubmit>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}

      <Link
        href="/personal/saude"
        className="mb-4 flex items-center gap-3 rounded-3xl border border-border bg-surface p-3 text-sm transition hover:border-bandeira-500"
      >
        <span className="text-xl" aria-hidden>🩺</span>
        <span className="flex-1 font-semibold">Levantamento de saúde dos alunos (anamnese)</span>
        <ChevronRight className="size-4 text-muted" aria-hidden />
      </Link>

      <div className="mb-4 flex gap-2" role="tablist">
        {[
          { href: "/personal/alunos", label: "Ativos", active: !showArchived },
          { href: "/personal/alunos?arquivados=1", label: "Arquivados", active: showArchived },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={t.active}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold",
              t.active ? "bg-anil-700 text-white dark:bg-ipe-500 dark:text-anil-900" : "bg-surface text-muted",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!students.length ? (
        <EmptyState icon={<Users className="size-8" />} title={showArchived ? "Nenhum aluno arquivado" : "Nenhum aluno ainda"}>
          {!showArchived && (
            <LinkButton href="/personal/convites" className="mt-3">
              Convidar aluno
            </LinkButton>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {students.map(({ student, role }) => (
            <li key={student!.id} className="flex items-center gap-2">
              <Link href={`/personal/alunos/${student!.id}`} className="min-w-0 flex-1">
                <Card className="flex items-center gap-3 p-4 transition hover:border-bandeira-500">
                  <Avatar path={student!.avatar_path} name={student!.full_name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{student!.full_name}</p>
                    <StudentStatus {...statsFor(student!.id)} />
                  </div>
                  {role === "compartilhado" && <Badge tone="blue">Compartilhado</Badge>}
                  <ChevronRight className="size-5 text-muted" aria-hidden />
                </Card>
              </Link>
              <WhatsAppButton phone={student!.phone} compact />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Treinos na semana atual + indicador de atividade (verde: ≤3 dias, amarelo: ≤7, vermelho: mais). */
function StudentStatus({ week, last }: { week: number; last: string | null }) {
  const days = last ? daysAgoSP(last) : null;
  const tone = days == null || days > 7 ? "bg-pitanga-500" : days > 3 ? "bg-ipe-500" : "bg-bandeira-500";
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
      <span className={cn("inline-block size-2 rounded-full", tone)} aria-hidden />
      <span>
        <strong className="text-foreground">{week}</strong> na semana
      </span>
      <span>· {last ? `último ${daysAgoLabel(days!)}` : "nunca treinou"}</span>
      {days != null && days > 7 && <span className="font-semibold text-pitanga-600">· sem treinar há {days} dias</span>}
    </p>
  );
}
