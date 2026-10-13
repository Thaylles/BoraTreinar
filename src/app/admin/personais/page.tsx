import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Lock, Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { EmptyState, PageTitle } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { requireAdmin } from "@/lib/admin-server";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/avatar";

export const metadata: Metadata = { title: "Personais · Admin" };

export default async function AdminPersonaisPage({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string; excluido?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  let query = db.from("profiles").select("id, full_name, email, phone, created_at, catalog_blocked, avatar_path").eq("role", "personal").order("full_name").limit(500);
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[%,()]/g, "")}%,email.ilike.%${q.replace(/[%,()]/g, "")}%`);
  if (sp.filtro === "bloqueados") query = query.eq("catalog_blocked", true);
  const { data: personals } = await query;

  const ids = (personals ?? []).map((p) => p.id);
  const { data: links } = ids.length
    ? await db.from("personal_students").select("personal_id").in("personal_id", ids).eq("status", "ativo")
    : { data: [] };
  const studentsOf = new Map<string, number>();
  for (const l of links ?? []) studentsOf.set(l.personal_id, (studentsOf.get(l.personal_id) ?? 0) + 1);

  return (
    <>
      <PageTitle sub="Todos os Personais cadastrados.">Personais</PageTitle>
      {sp.excluido && (
        <Alert kind="success" className="mb-4">
          Personal excluído. Os alunos dele foram avisados.
        </Alert>
      )}
      <form className="mb-4 flex gap-2" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Buscar por nome ou e-mail</span>
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" className={cn(inputClass, "pl-9")} />
        </label>
        {sp.filtro && <input type="hidden" name="filtro" value={sp.filtro} />}
      </form>
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/admin/personais" className={cn("rounded-full px-3 py-1 font-semibold", !sp.filtro ? "bg-bandeira-500 text-white" : "bg-border/50")}>
          Todos
        </Link>
        <Link
          href="/admin/personais?filtro=bloqueados"
          className={cn("rounded-full px-3 py-1 font-semibold", sp.filtro === "bloqueados" ? "bg-bandeira-500 text-white" : "bg-border/50")}
        >
          Bloqueados no catálogo
        </Link>
      </div>
      {!personals?.length ? (
        <EmptyState icon={<Search className="size-8" />} title="Nenhum Personal encontrado" />
      ) : (
        <ul className="space-y-2">
          {personals.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/personais/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-bandeira-500">
                <Avatar path={p.avatar_path} name={p.full_name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate font-semibold">
                    {p.full_name}
                    {p.catalog_blocked && <Lock className="size-3.5 text-pitanga-600" aria-label="bloqueado no catálogo" />}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {p.email} · desde {formatDate(p.created_at)}
                  </span>
                </span>
                <span className="text-right text-xs text-muted">
                  <strong className="block font-display text-lg text-foreground">{studentsOf.get(p.id) ?? 0}</strong>
                  alunos
                </span>
                <ChevronRight className="size-4 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
