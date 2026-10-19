"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EQUIPMENT_BUCKET, isMuscleGroup } from "@/lib/catalog";
import { friendlyError } from "@/lib/errors";

export type EquipmentInput = {
  id?: string;
  name: string;
  muscle_group: string;
  description: string;
  is_bodyweight: boolean;
  /** Cardio: "velocidade" (esteira) ou "nivel" (bicicleta, elíptico). */
  intensity_unit?: string;
  /** undefined = manter a imagem atual; null = remover; string = novo caminho no Storage */
  image_path?: string | null;
};

export async function saveEquipment(input: EquipmentInput): Promise<{ error: string } | void> {
  const name = input.name.trim();
  const description = input.description.trim() || null;
  if (name.length < 2 || name.length > 80) return { error: "O nome precisa ter entre 2 e 80 caracteres." };
  if (!isMuscleGroup(input.muscle_group)) return { error: "Escolha o grupo muscular." };
  if (description && description.length > 1000) return { error: "Descrição muito longa (máx. 1000 caracteres)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  if (input.image_path && !input.image_path.startsWith(`${user.id}/`)) {
    return { error: "Imagem inválida." };
  }

  const fields = {
    name,
    muscle_group: input.muscle_group,
    description,
    is_bodyweight: input.is_bodyweight,
    intensity_unit:
      input.muscle_group === "cardio" ? (input.intensity_unit === "velocidade" ? ("velocidade" as const) : ("nivel" as const)) : null,
    ...(input.image_path !== undefined && { image_path: input.image_path }),
  };

  let id = input.id;
  if (id) {
    const { data: current } = await supabase
      .from("equipment")
      .select("image_path, created_by")
      .eq("id", id)
      .single();
    if (!current || current.created_by !== user.id) return { error: "Você só pode editar exercícios criados por você." };

    const { error } = await supabase.from("equipment").update(fields).eq("id", id);
    if (error) return { error: duplicateMessage(error.message) };
    // Imagem antiga substituída/removida: limpa do Storage.
    if (input.image_path !== undefined && current.image_path && current.image_path !== input.image_path) {
      await supabase.storage.from(EQUIPMENT_BUCKET).remove([current.image_path]);
    }
  } else {
    const { data, error } = await supabase
      .from("equipment")
      .insert({ ...fields, created_by: user.id })
      .select("id")
      .single();
    if (error) return { error: duplicateMessage(error.message) };
    id = data.id;
  }

  revalidatePath("/personal/exercicios");
  redirect(`/personal/exercicios/${id}?salvo=1`);
}

export async function deleteEquipment(fd: FormData) {
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { data: eq } = await supabase.from("equipment").select("image_path").eq("id", id).single();
  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if (error) {
    redirect(`/personal/exercicios/${id}?erro=${encodeURIComponent(
      /foreign key/i.test(error.message)
        ? "Esse exercício está em uso em fichas ou treinos e não pode ser excluído."
        : friendlyError(error.message),
    )}`);
  }
  if (eq?.image_path) await supabase.storage.from(EQUIPMENT_BUCKET).remove([eq.image_path]);
  revalidatePath("/personal/exercicios");
  redirect("/personal/exercicios");
}

function duplicateMessage(message: string) {
  return /duplicate key|unique/i.test(message)
    ? "Você já tem um exercício com esse nome."
    : friendlyError(message);
}

/** Troca (ou remove, com path null) a foto de um exercício do catálogo padrão — vale para todos. */
export async function setCatalogImage(equipmentId: string, imagePath: string | null): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  const { data: current } = await supabase.from("equipment").select("image_path").eq("id", equipmentId).single();

  const { error } = await supabase.rpc("set_equipment_image", { p_equipment: equipmentId, p_image_path: imagePath });
  if (error) return { error: friendlyError(error.message) };

  // A foto anterior só pode ser apagada do Storage se estiver na pasta deste Personal.
  if (current?.image_path && current.image_path !== imagePath && current.image_path.startsWith(`${user.id}/`)) {
    await supabase.storage.from(EQUIPMENT_BUCKET).remove([current.image_path]);
  }
  revalidatePath("/personal/exercicios");
  revalidatePath(`/personal/exercicios/${equipmentId}`);
}
