import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, SearchX } from "lucide-react";
import { Badge, EmptyState, PageTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { EquipmentImage } from "@/components/equipment-image";
import { requireRole } from "@/lib/auth";
import { MUSCLE_GROUPS, groupLabel, isMuscleGroup } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Exercícios" };

export default async function ExerciciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; grupo?: string; meus?: string }>;
}) {
  const { profile } = await requireRole("personal");
  const { q = "", grupo, meus } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("equipment")
    .select("id, name, muscle_group, image_path, image_url, is_default, created_by, is_bodyweight")
    .order("name");
  if (q.trim()) query = query.ilike("name", `%${q.trim().replace(/[%_]/g, "")}%`);
  if (isMuscleGroup(grupo)) query = query.eq("muscle_group", grupo);
  if (meus === "1") query = query.eq("created_by", profile.id);
  const { data: items } = await query;

  const href = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q: q || undefined, grupo, meus, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/personal/exercicios${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageTitle sub={`${items?.length ?? 0} no catálogo`}>Exercícios</PageTitle>
        {!profile.catalog_blocked && (
          <LinkButton href="/personal/exercicios/novo" size="sm" className="mt-1 shrink-0">
            <Plus className="size-4" aria-hidden /> Novo
          </LinkButton>
        )}
      </div>
      {profile.catalog_blocked && (
        <p className="mb-3 rounded-2xl bg-border/40 px-3 py-2 text-sm text-muted">
          🔒 Sua conta está sem permissão para criar ou editar exercícios. Você continua usando o catálogo nas fichas.
        </p>
      )}

      <form className="relative mb-3" role="search">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar exercício…"
          aria-label="Buscar exercício"
          className={cn(inputClass, "pl-12")}
        />
        {grupo && <input type="hidden" name="grupo" value={grupo} />}
        {meus && <input type="hidden" name="meus" value={meus} />}
      </form>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[
          { label: "Todos", active: !grupo && meus !== "1", to: href({ grupo: undefined, meus: undefined }) },
          { label: "Criados por mim", active: meus === "1", to: href({ meus: meus === "1" ? undefined : "1" }) },
          ...MUSCLE_GROUPS.map((g) => ({
            label: g.label,
            active: grupo === g.value,
            to: href({ grupo: grupo === g.value ? undefined : g.value }),
          })),
        ].map((chip) => (
          <Link
            key={chip.label}
            href={chip.to}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition",
              chip.active
                ? "bg-anil-700 text-white dark:bg-ipe-500 dark:text-anil-900"
                : "border border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {!items?.length ? (
        <EmptyState icon={<SearchX className="size-8" />} title="Nada encontrado">
          Não achou? Cadastre um exercício novo.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((e) => (
            <li key={e.id}>
              <Link
                href={`/personal/exercicios/${e.id}`}
                className="block h-full rounded-3xl border border-border bg-surface p-2 transition hover:border-bandeira-500"
              >
                <EquipmentImage equipment={e} />
                <div className="px-1 pb-1 pt-2">
                  <p className="line-clamp-2 text-sm font-semibold leading-tight">{e.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="text-xs text-muted">{groupLabel(e.muscle_group)}</span>
                    {e.created_by === profile.id && <Badge tone="green">Meu</Badge>}
                    {!e.is_default && e.created_by !== profile.id && <Badge tone="blue">Outro Personal</Badge>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
