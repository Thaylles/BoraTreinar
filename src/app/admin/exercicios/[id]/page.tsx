import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { AdminEquipmentForm } from "@/components/admin/equipment-form";
import { requireAdmin } from "@/lib/admin-server";

export const metadata: Metadata = { title: "Editar exercício · Admin" };

export default async function AdminExercicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { db }] = await Promise.all([params, requireAdmin()]);
  const { data: eq } = await db
    .from("equipment")
    .select(
      "id, name, muscle_group, description, is_bodyweight, locked, is_default, image_path, image_url, image_credit, owner:profiles!equipment_created_by_fkey(full_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!eq) notFound();

  return (
    <>
      <Link
        href="/admin/exercicios"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Exercícios
      </Link>
      <Card>
        <h1 className="font-display text-2xl font-extrabold">
          Editar exercício
        </h1>
        <div className="mt-2 mb-4 flex flex-wrap gap-2">
          {eq.is_default ? (
            <Badge tone="yellow">Catálogo BoraTreinar</Badge>
          ) : (
            <Badge tone="blue">
              De {eq.owner?.full_name ?? "Personal excluído"}
            </Badge>
          )}
          {eq.image_credit && <Badge>Imagem: {eq.image_credit}</Badge>}
        </div>
        <AdminEquipmentForm equipment={eq} />
      </Card>
    </>
  );
}
