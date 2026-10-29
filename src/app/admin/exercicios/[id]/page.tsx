import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { AdminEquipmentForm } from "@/components/admin/equipment-form";
import { DeleteEquipment } from "@/components/admin/delete-equipment";
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
  const [{ count: plans }, { count: sets }, { data: options }] = await Promise.all([
    db.from("workout_plan_items").select("id", { count: "exact", head: true }).eq("equipment_id", id),
    db.from("session_sets").select("id", { count: "exact", head: true }).eq("equipment_id", id),
    db.from("equipment").select("id, name, muscle_group").eq("is_default", true).neq("id", id).order("name"),
  ]);

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
      <Card className="mt-6 border-pitanga-500/40">
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-pitanga-600">Excluir exercício</h2>
        <DeleteEquipment equipment={eq} usage={{ plans: plans ?? 0, sets: sets ?? 0 }} options={options ?? []} />
      </Card>
    </>
  );
}
