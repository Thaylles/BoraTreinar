import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, Card } from "@/components/ui/card";
import { EquipmentImage } from "@/components/equipment-image";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { requireRole } from "@/lib/auth";
import { groupLabel } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { EquipmentForm } from "../equipment-form";
import { deleteEquipment } from "../actions";

export const metadata: Metadata = { title: "Exercício" };

export default async function ExercicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string; erro?: string; editar?: string }>;
}) {
  const [{ id }, sp, { profile }] = await Promise.all([params, searchParams, requireRole("personal")]);
  const supabase = await createClient();
  const { data: eq } = await supabase
    .from("equipment")
    .select("*, creator:profiles!equipment_created_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!eq) notFound();
  const mine = eq.created_by === profile.id;

  return (
    <>
      <Link href="/personal/exercicios" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Exercícios
      </Link>

      {sp.salvo && (
        <Alert kind="success" className="mb-4">
          Exercício salvo! {!eq.image_path && "Quando puder, adicione uma foto para o aluno reconhecer o equipamento."}
        </Alert>
      )}
      {sp.erro && <Alert className="mb-4">{sp.erro}</Alert>}

      {mine && sp.editar === "1" ? (
        <Card>
          <h1 className="mb-4 font-display text-2xl font-extrabold">Editar exercício</h1>
          <EquipmentForm userId={profile.id} initial={eq} />
        </Card>
      ) : (
        <>
          <EquipmentImage equipment={eq} className="mb-4 max-h-80" />
          <h1 className="font-display text-3xl font-extrabold leading-tight">{eq.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="green">{groupLabel(eq.muscle_group)}</Badge>
            {eq.is_bodyweight && <Badge>Peso corporal</Badge>}
            {eq.is_default ? <Badge tone="yellow">Catálogo BoraTreinar</Badge> : <Badge tone="blue">Criado por {mine ? "você" : (eq.creator?.full_name ?? "um Personal")}</Badge>}
          </div>
          {eq.description && <p className="mt-4 leading-relaxed">{eq.description}</p>}
          {eq.image_credit && <p className="mt-4 text-xs text-muted">Imagem: {eq.image_credit}</p>}

          {mine && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/personal/exercicios/${eq.id}?editar=1`}
                className="rounded-2xl bg-bandeira-500 px-4 py-2.5 font-display font-bold text-white hover:bg-bandeira-600"
              >
                Editar
              </Link>
              <form action={deleteEquipment}>
                <input type="hidden" name="id" value={eq.id} />
                <ConfirmSubmit
                  message="Excluir este exercício?"
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 font-semibold text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15"
                >
                  <Trash2 className="size-4" aria-hidden /> Excluir
                </ConfirmSubmit>
              </form>
            </div>
          )}
        </>
      )}
    </>
  );
}
