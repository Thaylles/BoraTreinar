"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";

export async function createInvite(_: ActionState, fd: FormData): Promise<ActionState & { token?: string }> {
  const days = Number(fd.get("days") ?? 7);
  const label = String(fd.get("label") ?? "").trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", {
    p_days: days,
    p_label: label || undefined,
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/personal/convites");
  return { ok: "Convite criado! Copie o link e mande para o aluno.", token: data.token };
}

export async function revokeInvite(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("revoke_invite", { p_invite: String(fd.get("id")) });
  revalidatePath("/personal/convites");
}

export async function requestTransfer(_: ActionState, fd: FormData): Promise<ActionState> {
  const studentId = String(fd.get("student_id"));
  const kind = fd.get("kind") === "transferencia" ? "transferencia" : "compartilhamento";
  const email = String(fd.get("email") ?? "").trim();
  if (!email) return { error: "Informe o e-mail do outro Personal." };

  const supabase = await createClient();
  const { data: found } = await supabase.rpc("find_personal_by_email", { p_email: email });
  const target = found?.[0];
  if (!target) {
    return { error: "Não achamos um Personal com esse e-mail no BoraTreinar." };
  }
  const { error } = await supabase.rpc("request_student_transfer", {
    p_student: studentId,
    p_to_personal: target.id,
    p_kind: kind,
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(`/personal/alunos/${studentId}`);
  return {
    ok: `Pedido enviado para ${target.full_name}. ${
      kind === "transferencia"
        ? "Quando aceitar, o aluno passa a ser dele(a) e você perde o acesso."
        : "Quando aceitar, vocês dois acompanham o aluno."
    }`,
  };
}

export async function cancelTransfer(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("cancel_student_transfer", { p_transfer: String(fd.get("id")) });
  revalidatePath("/personal", "layout");
}

export async function respondTransfer(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("respond_student_transfer", {
    p_transfer: String(fd.get("id")),
    p_accept: fd.get("accept") === "1",
  });
  revalidatePath("/personal", "layout");
}

export async function revokeShare(fd: FormData) {
  const studentId = String(fd.get("student_id"));
  const supabase = await createClient();
  await supabase.rpc("revoke_student_share", {
    p_student: studentId,
    p_personal: String(fd.get("personal_id")),
  });
  revalidatePath(`/personal/alunos/${studentId}`);
}

export async function setArchived(fd: FormData) {
  const studentId = String(fd.get("student_id"));
  const supabase = await createClient();
  await supabase.rpc("set_student_archived", {
    p_student: studentId,
    p_archived: fd.get("archived") === "1",
  });
  revalidatePath("/personal", "layout");
}
