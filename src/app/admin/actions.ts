"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-server";
import { friendlyError, type ActionState } from "@/lib/errors";
import { normalizePhoneBR } from "@/lib/phone";
import { EQUIPMENT_BUCKET, isMuscleGroup } from "@/lib/catalog";
import { escapeHtml, sendEmailDetailed } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { MEDIA_BUCKET } from "@/lib/exercise-media";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** Edita nome, e-mail, telefone e nascimento de um Personal ou aluno. */
export async function adminUpdateProfile(
  _: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { db } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return { error: "Perfil inválido." };
  const fullName = String(fd.get("full_name") ?? "").trim();
  const email = String(fd.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phoneRaw = String(fd.get("phone") ?? "").trim();
  const birth = String(fd.get("birth_date") ?? "").trim();
  if (fullName.length < 2) return { error: "Informe o nome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "E-mail inválido." };
  // Guardado só com dígitos, como no cadastro; a validação usa a mesma regra do link do WhatsApp.
  const phone = phoneRaw.replace(/\D/g, "") || null;
  if (phoneRaw && !normalizePhoneBR(phoneRaw))
    return { error: "Telefone inválido. Use DDD + número." };
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth))
    return { error: "Data de nascimento inválida." };

  const { data: current } = await db
    .from("profiles")
    .select("email, role")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { error: "Perfil não encontrado." };
  if (current.email.toLowerCase() !== email) {
    const { error } = await db.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
    });
    if (error) return { error: friendlyError(error.message) };
  }
  const { error } = await db
    .from("profiles")
    .update({ full_name: fullName, email, phone, birth_date: birth || null })
    .eq("id", id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/admin", "layout");
  return { ok: "Perfil atualizado ✅" };
}

/** Liga/desliga a permissão do Personal de criar, editar e trocar fotos de exercícios. */
export async function adminSetCatalogBlocked(fd: FormData) {
  const { db } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return;
  await db
    .from("profiles")
    .update({ catalog_blocked: fd.get("blocked") === "1" })
    .eq("id", id)
    .eq("role", "personal");
  revalidatePath("/admin", "layout");
}

/** Trava/destrava um exercício: travado, nenhum Personal edita, exclui ou troca a foto. */
export async function adminSetEquipmentLocked(fd: FormData) {
  const { db } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return;
  await db
    .from("equipment")
    .update({ locked: fd.get("locked") === "1" })
    .eq("id", id);
  revalidatePath("/admin/exercicios");
}

const PHOTO_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * Admin edita qualquer exercício (inclusive os travados): nome, grupo, descrição, peso corporal,
 * trava e foto. A foto nova vai para o Storage pela service role e tem prioridade sobre a
 * ilustração do catálogo; "remover" volta para a ilustração (quando houver).
 */
export async function adminSaveEquipment(
  _: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { db, profile: me } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return { error: "Exercício inválido." };
  const name = String(fd.get("name") ?? "").trim();
  const muscleGroup = String(fd.get("muscle_group") ?? "");
  const description = String(fd.get("description") ?? "").trim() || null;
  if (name.length < 2 || name.length > 80)
    return { error: "O nome precisa ter entre 2 e 80 caracteres." };
  if (!isMuscleGroup(muscleGroup))
    return { error: "Escolha o grupo muscular." };
  if (description && description.length > 1000)
    return { error: "Descrição muito longa (máx. 1000 caracteres)." };

  const { data: current } = await db
    .from("equipment")
    .select("image_path, image_url, is_default")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { error: "Exercício não encontrado." };

  const photo = fd.get("photo");
  const removePhoto = fd.get("remove_photo") === "1";
  let image: {
    image_path: string | null;
    image_credit: string | null;
    image_updated_by: string | null;
    image_updated_at: string;
  } | null = null;
  if (photo instanceof File && photo.size > 0) {
    const ext = PHOTO_TYPES[photo.type];
    if (!ext) return { error: "Use uma imagem WebP, JPEG ou PNG." };
    if (photo.size > 2 * 1024 * 1024)
      return { error: "Imagem muito grande (máx. 2 MB)." };
    const path = `admin/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage
      .from(EQUIPMENT_BUCKET)
      .upload(path, photo, {
        contentType: photo.type,
        cacheControl: "31536000",
      });
    if (error)
      return { error: "Não foi possível enviar a imagem. Tenta de novo?" };
    image = {
      image_path: path,
      image_credit: "Foto enviada pelo administrador",
      image_updated_by: me.id,
      image_updated_at: new Date().toISOString(),
    };
  } else if (removePhoto && current.image_path) {
    image = {
      image_path: null,
      image_credit: current.image_url
        ? "Ilustração do catálogo BoraTreinar"
        : null,
      image_updated_by: null,
      image_updated_at: new Date().toISOString(),
    };
  }

  const { error } = await db
    .from("equipment")
    .update({
      name,
      muscle_group: muscleGroup,
      description,
      is_bodyweight: fd.get("is_bodyweight") === "on",
      locked: fd.get("locked") === "on",
      ...image,
    })
    .eq("id", id);
  if (error) {
    if (image?.image_path)
      await db.storage.from(EQUIPMENT_BUCKET).remove([image.image_path]);
    return {
      error: /duplicate key|unique/i.test(error.message)
        ? "Já existe um exercício com esse nome."
        : friendlyError(error.message),
    };
  }
  // A foto anterior enviada ao Storage não é mais usada.
  if (image && current.image_path && current.image_path !== image.image_path) {
    await db.storage.from(EQUIPMENT_BUCKET).remove([current.image_path]);
  }
  revalidatePath("/admin/exercicios");
  revalidatePath(`/admin/exercicios/${id}`);
  revalidatePath("/personal/exercicios", "layout");
  return { ok: "Exercício salvo ✅" };
}

/**
 * Exclui um exercício. Se estiver em fichas ou em treinos registrados, tudo passa para o
 * substituto escolhido (o histórico continua). Apaga também a foto e as execuções do Storage.
 */
export async function adminDeleteEquipment(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const replacement = String(fd.get("replacement") ?? "");
  if (!isUuid(id)) return { error: "Exercício inválido." };
  if (replacement && !isUuid(replacement)) return { error: "Escolha o exercício substituto." };
  const { data, error } = await db.rpc("admin_delete_equipment", {
    p_equipment: id,
    p_replacement: replacement || null,
  });
  if (error) return { error: friendlyError(error.message) };
  const res = data as { image_path: string | null; media_paths: string[] };
  if (res.image_path) await db.storage.from(EQUIPMENT_BUCKET).remove([res.image_path]);
  if (res.media_paths?.length) await db.storage.from(MEDIA_BUCKET).remove(res.media_paths);
  revalidatePath("/", "layout");
  redirect(`/admin/exercicios?excluido=${encodeURIComponent(String(fd.get("name") ?? ""))}`);
}

/** Exclui um Personal (a conta e, em cascata, vínculos, convites, aulas e relatórios dele). */
export async function adminDeletePersonal(
  _: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { db, profile: me } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id) || id === me.id)
    return { error: "Não é possível excluir esta conta." };
  const { data: target } = await db
    .from("profiles")
    .select("full_name, role")
    .eq("id", id)
    .maybeSingle();
  if (!target || target.role !== "personal")
    return { error: "Personal não encontrado." };
  if (
    String(fd.get("confirm") ?? "")
      .trim()
      .toUpperCase() !== "EXCLUIR"
  )
    return { error: "Digite EXCLUIR para confirmar." };

  // Avisa os alunos que perdem este Personal.
  const { data: links } = await db
    .from("personal_students")
    .select("student_id")
    .eq("personal_id", id)
    .eq("status", "ativo");
  if (links?.length) {
    await db.from("notifications").insert(
      links.map((l) => ({
        user_id: l.student_id,
        title: "Seu Personal saiu do BoraTreinar",
        body: `${target.full_name} não está mais no app. Seus treinos e histórico continuam com você.`,
        link: "/aluno/personais",
      })),
    );
  }
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/admin", "layout");
  redirect("/admin/personais?excluido=1");
}

/** Envia um e-mail de teste para o próprio admin e devolve o resultado (ou o motivo da falha). */
export async function adminSendTestEmail(): Promise<ActionState> {
  const { profile: me } = await requireAdmin();
  const when = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const html = `<div style="font-family:Arial,sans-serif;color:#10213f">
    <h2 style="color:#009C3B">Funcionou! ✅</h2>
    <p>Este é um e-mail de teste do BoraTreinar, enviado em ${escapeHtml(when)}.</p>
    <p>Se você está lendo isto, o lembrete das 7h e o relatório de domingo também vão chegar.</p>
    <p><a href="${appUrl}/admin">Abrir o painel do admin</a></p>
  </div>`;
  const r = await sendEmailDetailed(me.email, "Teste de e-mail — BoraTreinar", html);
  if (!r.ok) return { error: r.error ?? "Falha no envio." };
  const via = r.via === "gmail" ? "pelo Gmail" : "pelo Resend";
  return { ok: `E-mail enviado ${via} para ${me.email}. Confira a caixa de entrada (e o spam).` };
}
