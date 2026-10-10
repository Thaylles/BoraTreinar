import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { formatPhoneBR } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";

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
    .select("role, archived_at, student:profiles!personal_students_student_id_fkey(id, full_name, phone)")
    .eq("personal_id", profile.id)
    .eq("status", "ativo");
  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data: links } = await query;

  const students = (links ?? [])
    .filter((l) => l.student)
    .sort((a, b) => a.student!.full_name.localeCompare(b.student!.full_name, "pt-BR"));

  return (
    <>
      <PageTitle sub={`${students.length} ${showArchived ? "arquivado(s)" : "ativo(s)"}`}>Alunos</PageTitle>

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
            <li key={student!.id}>
              <Link href={`/personal/alunos/${student!.id}`}>
                <Card className="flex items-center gap-3 p-4 transition hover:border-bandeira-500">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-bandeira-50 font-display text-lg font-bold text-bandeira-700 dark:bg-bandeira-500/15 dark:text-bandeira-100">
                    {student!.full_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{student!.full_name}</p>
                    <p className="text-xs text-muted">{formatPhoneBR(student!.phone) || "Sem telefone"}</p>
                  </div>
                  {role === "compartilhado" && <Badge tone="blue">Compartilhado</Badge>}
                  <ChevronRight className="size-5 text-muted" aria-hidden />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
