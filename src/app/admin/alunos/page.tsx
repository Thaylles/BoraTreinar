import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { requireAdmin } from "@/lib/admin-server";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Alunos · Admin" };

export default async function AdminAlunosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { db } = await requireAdmin();
  const q = ((await searchParams).q ?? "").trim().replace(/[%,()]/g, "");
  let query = db.from("profiles").select("id, full_name, email").eq("role", "aluno").order("full_name").limit(500);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data: students } = await query;
  const ids = (students ?? []).map((s) => s.id);
  const { data: links } = ids.length
    ? await db
        .from("personal_students")
        .select("student_id, personal:profiles!personal_students_personal_id_fkey(full_name)")
        .in("student_id", ids)
        .eq("status", "ativo")
    : { data: [] };
  const personalsOf = new Map<string, string[]>();
  for (const l of links ?? []) personalsOf.set(l.student_id, [...(personalsOf.get(l.student_id) ?? []), l.personal?.full_name ?? "—"]);

  return (
    <>
      <PageTitle sub="Todos os alunos e seus Personais.">Alunos</PageTitle>
      <form className="mb-4" role="search">
        <label className="relative block">
          <span className="sr-only">Buscar por nome ou e-mail</span>
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" className={cn(inputClass, "pl-9")} />
        </label>
      </form>
      {!students?.length ? (
        <EmptyState icon={<Search className="size-8" />} title="Nenhum aluno encontrado" />
      ) : (
        <ul className="space-y-2">
          {students.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/alunos/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-bandeira-500">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.full_name}</span>
                  <span className="block truncate text-xs text-muted">{s.email}</span>
                </span>
                <span className="max-w-[45%] truncate text-right text-xs text-muted">
                  {personalsOf.get(s.id)?.join(", ") || "sem Personal ativo"}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
