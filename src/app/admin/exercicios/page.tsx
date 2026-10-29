import type { Metadata } from "next";
import Link from "next/link";
import { Lock, LockOpen, Pencil, Search } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EquipmentImage } from "@/components/equipment-image";
import { inputClass } from "@/components/ui/field";
import { adminSetEquipmentLocked } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin-server";
import { groupLabel } from "@/lib/catalog";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Exercícios · Admin" };

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "padrao", label: "Catálogo padrão" },
  { key: "proprios", label: "De Personais" },
  { key: "travados", label: "Travados" },
] as const;

export default async function AdminExerciciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string; excluido?: string }>;
}) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  const filtro = sp.filtro ?? "";
  let query = db
    .from("equipment")
    .select(
      "id, name, muscle_group, is_default, locked, created_by, image_credit, image_path, image_url, owner:profiles!equipment_created_by_fkey(full_name)",
    )
    .order("muscle_group")
    .order("name")
    .limit(1000);
  if (q) query = query.ilike("name", `%${q}%`);
  if (filtro === "padrao") query = query.eq("is_default", true);
  if (filtro === "proprios") query = query.eq("is_default", false);
  if (filtro === "travados") query = query.eq("locked", true);
  const { data: items } = await query;
  const href = (f: string) =>
    `/admin/exercicios?${new URLSearchParams({ ...(q ? { q } : {}), ...(f ? { filtro: f } : {}) })}`;

  return (
    <>
      <PageTitle sub="Toque num exercício para editar nome, foto e descrição. Travado, nenhum Personal edita, exclui ou troca a foto.">
        Exercícios e máquinas
      </PageTitle>
      {sp.excluido && (
        <Alert kind="success" className="mb-3">
          Exercício “{sp.excluido}” excluído.
        </Alert>
      )}
      <form className="mb-3" role="search">
        <label className="relative block">
          <span className="sr-only">Buscar exercício</span>
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar exercício"
            className={cn(inputClass, "pl-9")}
          />
        </label>
        {filtro && <input type="hidden" name="filtro" value={filtro} />}
      </form>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href(f.key)}
            className={cn(
              "rounded-full px-3 py-1 font-semibold",
              filtro === f.key ? "bg-bandeira-500 text-white" : "bg-border/50",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {!items?.length ? (
        <EmptyState
          icon={<Search className="size-8" />}
          title="Nenhum exercício encontrado"
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            {items.length} {items.length === 1 ? "exercício" : "exercícios"} ·{" "}
            {items.filter((e) => e.locked).length} travados
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((e) => (
              <li
                key={e.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-2xl border bg-surface text-sm",
                  e.locked ? "border-pitanga-500/50" : "border-border",
                )}
              >
                <Link
                  href={`/admin/exercicios/${e.id}`}
                  aria-label={`Editar ${e.name}`}
                >
                  <EquipmentImage equipment={e} fit="contain" />
                </Link>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-1 font-semibold leading-snug">
                      {e.locked && (
                        <Lock
                          className="mt-0.5 size-3.5 shrink-0 text-pitanga-600"
                          aria-label="travado"
                        />
                      )}
                      <Link
                        href={`/admin/exercicios/${e.id}`}
                        className="hover:underline"
                      >
                        {e.name}
                      </Link>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {groupLabel(e.muscle_group)} ·{" "}
                      {e.is_default
                        ? "catálogo padrão"
                        : `de ${e.owner?.full_name ?? "Personal excluído"}`}
                      {e.is_default &&
                      e.image_credit?.startsWith("Foto enviada")
                        ? ` · ${e.image_credit}`
                        : ""}
                    </span>
                  </span>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/exercicios/${e.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-bold transition hover:border-bandeira-500"
                    >
                      <Pencil className="size-3.5" aria-hidden /> Editar
                    </Link>
                    <form action={adminSetEquipmentLocked} className="flex-1">
                      <input type="hidden" name="id" value={e.id} />
                      <input
                        type="hidden"
                        name="locked"
                        value={e.locked ? "0" : "1"}
                      />
                      <button
                        className={cn(
                          "inline-flex w-full items-center justify-center gap-1 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition",
                          e.locked
                            ? "border-pitanga-500 text-pitanga-600 hover:bg-pitanga-100"
                            : "border-border hover:border-bandeira-500",
                        )}
                        aria-label={
                          e.locked ? `Destravar ${e.name}` : `Travar ${e.name}`
                        }
                      >
                        {e.locked ? (
                          <LockOpen className="size-3.5" aria-hidden />
                        ) : (
                          <Lock className="size-3.5" aria-hidden />
                        )}
                        {e.locked ? "Destravar" : "Travar"}
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
