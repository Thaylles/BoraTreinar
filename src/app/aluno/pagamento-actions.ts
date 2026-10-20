"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** "Já paguei": avisa o Personal, que confirma o recebimento. */
export async function reportPayment(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("report_payment", { p_payment: String(fd.get("id")) });
  revalidatePath("/aluno/aulas");
}
