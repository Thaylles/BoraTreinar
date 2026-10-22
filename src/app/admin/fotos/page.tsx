import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-server";
import { equipmentImageSrc, groupLabel } from "@/lib/catalog";
import { photoStatus } from "@/lib/exercise-media";
import { cn } from "@/lib/cn";
import { PhotoBoard, type PhotoItem } from "./photo-board";

export const metadata: Metadata = { title: "Fotos com IA · Admin" };
// A geração de cada imagem leva de 10 a 40 s.
export const maxDuration = 120;

export default async function FotosPage({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const { db } = await requireAdmin();
  const todos = (await searchParams).todos === "1";
  const { data: eqs } = await db
    .from("equipment")
    .select("id, name, muscle_group, is_default, image_url, image_path, image_credit, owner:profiles!equipment_created_by_fkey(full_name)")
    .order("is_default", { ascending: false })
    .order("muscle_group")
    .order("name");
  const all = (eqs ?? []).map((e) => ({ ...e, status: photoStatus(e) }));
  const pending = all.filter((e) => e.status !== "ok");
  const list = todos ? all : pending;
  const items: PhotoItem[] = list.map((e) => ({
    id: e.id,
    name: e.name,
    group: groupLabel(e.muscle_group),
    owner: e.is_default ? null : (e.owner?.full_name ?? "Personal"),
    src: equipmentImageSrc(e),
    status: e.status,
  }));
  const tab = (on: boolean) =>
    cn("rounded-full px-3 py-1.5 text-sm font-semibold", on ? "bg-anil-700 text-white dark:bg-ipe-500 dark:text-anil-900" : "border border-border bg-surface text-muted");

  return (
    <>
      <PageTitle sub="Crie com IA a foto dos exercícios sem imagem ou fora do padrão, no mesmo estilo do catálogo. Nada muda até você aprovar.">
        Fotos com IA
      </PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/fotos" className={tab(!todos)}>
          Precisam de foto ({pending.length})
        </Link>
        <Link href="/admin/fotos?todos=1" className={tab(todos)}>
          Todos os exercícios ({all.length})
        </Link>
      </div>
      {items.length ? (
        <PhotoBoard items={items} />
      ) : (
        <p className="text-sm text-muted">Todos os exercícios já têm foto no padrão do catálogo. 🎉</p>
      )}
      <p className="mt-6 text-xs text-muted">
        A IA usa fotos do catálogo como referência de estilo. Cada imagem gerada é cobrada na conta do Google (Gemini) configurada na
        Vercel. Inclui os exercícios criados pelos Personais.
      </p>
    </>
  );
}
