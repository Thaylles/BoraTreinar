"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-server";
import { friendlyError, type ActionState } from "@/lib/errors";
import { normalizePhoneBR } from "@/lib/phone";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** Edita nome, e-mail, telefone e nascimento de um Personal ou aluno. */
export async function adminUpdateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return { error: "Perfil inválido." };
  const fullName = String(fd.get("full_name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(fd.get("phone") ?? "").trim();
  const birth = String(fd.get("birth_date") ?? "").trim();
  if (fullName.length < 2) return { error: "Informe o nome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "E-mail inválido." };
  // Guardado só com dígitos, como no cadastro; a validação usa a mesma regra do link do WhatsApp.
  const phone = phoneRaw.replace(/\D/g, "") || null;
  if (phoneRaw && !normalizePhoneBR(phoneRaw)) return { error: "Telefone inválido. Use DDD + número." };
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return { error: "Data de nascimento inválida." };

  const { data: current } = await db.from("profiles").select("email, role").eq("id", id).maybeSingle();
  if (!current) return { error: "Perfil não encontrado." };
  if (current.email.toLowerCase() !== email) {
    const { error } = await db.auth.admin.updateUserById(id, { email, email_confirm: true });
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
  await db.from("profiles").update({ catalog_blocked: fd.get("blocked") === "1" }).eq("id", id).eq("role", "personal");
  revalidatePath("/admin", "layout");
}

/** Trava/destrava um exercício: travado, nenhum Personal edita, exclui ou troca a foto. */
export async function adminSetEquipmentLocked(fd: FormData) {
  const { db } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return;
  await db.from("equipment").update({ locked: fd.get("locked") === "1" }).eq("id", id);
  revalidatePath("/admin/exercicios");
}

/** Exclui um Personal (a conta e, em cascata, vínculos, convites, aulas e relatórios dele). */
export async function adminDeletePersonal(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, profile: me } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id) || id === me.id) return { error: "Não é possível excluir esta conta." };
  const { data: target } = await db.from("profiles").select("full_name, role").eq("id", id).maybeSingle();
  if (!target || target.role !== "personal") return { error: "Personal não encontrado." };
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "EXCLUIR") return { error: "Digite EXCLUIR para confirmar." };

  // Avisa os alunos que perdem este Personal.
  const { data: links } = await db.from("personal_students").select("student_id").eq("personal_id", id).eq("status", "ativo");
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
