"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** O aluno aceita ou recusa o pedido de um Personal para acompanhá-lo. */
export async function respondLinkRequest(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("respond_link_request", {
    p_request: String(fd.get("id")),
    p_accept: fd.get("accept") === "1",
  });
  revalidatePath("/aluno", "layout");
}
