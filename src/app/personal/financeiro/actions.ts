"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";
import { SUGGESTED_PACKAGES, parseMoney } from "@/lib/finance";

const done = () => revalidatePath("/personal/financeiro", "page");

export async function createPackage(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = String(fd.get("name") ?? "").trim();
  const kind = fd.get("kind") === "mensal" ? "mensal" : "por_aula";
  const perWeek = Number(fd.get("classes_per_week"));
  const price = parseMoney(fd.get("price"));
  if (!name) return { error: "Dê um nome ao pacote." };
  if (!price) return { error: "Informe o valor." };
  if (kind === "mensal" && !(Number.isInteger(perWeek) && perWeek >= 1 && perWeek <= 7)) {
    return { error: "Escolha quantas aulas por semana (1 a 7)." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_packages")
    .insert({ name, kind, price, classes_per_week: kind === "mensal" ? perWeek : null });
  if (error) return { error: friendlyError(error.message) };
  done();
  return { ok: "Pacote criado!" };
}

export async function createSuggestedPackages() {
  const supabase = await createClient();
  await supabase.from("payment_packages").insert(SUGGESTED_PACKAGES);
  done();
}

export async function deletePackage(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("payment_packages").delete().eq("id", String(fd.get("id")));
  done();
}

export async function saveBilling(_: ActionState, fd: FormData): Promise<ActionState> {
  const studentId = String(fd.get("student_id") ?? "");
  const pkg = String(fd.get("package_id") ?? "");
  const custom = pkg === "custom";
  const dueDay = Number(fd.get("due_day"));
  const amount = custom ? parseMoney(fd.get("amount")) : null;
  if (!studentId) return { error: "Aluno inválido." };
  if (!pkg) return { error: "Escolha um pacote." };
  if (custom && !amount) return { error: "Informe o valor." };
  if (!(Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31)) return { error: "Escolha o dia do pagamento." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_student_billing", {
    p_student: studentId,
    p_package: custom ? null : pkg,
    p_label: custom ? String(fd.get("label") ?? "").trim() || "Aulas" : null,
    p_kind: custom ? (fd.get("kind") === "mensal" ? "mensal" : "por_aula") : null,
    p_amount: amount,
    p_due_day: dueDay,
  });
  if (error) return { error: friendlyError(error.message) };
  done();
  return { ok: "Plano salvo! A cobrança do mês foi atualizada." };
}

export async function removeBilling(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("remove_student_billing", { p_student: String(fd.get("student_id")) });
  done();
}

export async function togglePaid(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("set_payment_paid", { p_payment: String(fd.get("id")), p_paid: fd.get("paid") === "1" });
  done();
}

export async function setPaymentAmount(_: ActionState, fd: FormData): Promise<ActionState> {
  const amount = parseMoney(fd.get("amount"));
  if (amount == null) return { error: "Valor inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_payment_amount", { p_payment: String(fd.get("id")), p_amount: amount });
  if (error) return { error: friendlyError(error.message) };
  done();
  return { ok: "Valor ajustado." };
}
