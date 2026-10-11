import "server-only";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Garante que quem chama é admin e devolve o cliente com service role.
 * Toda leitura/escrita da área admin passa por aqui — nunca use o cliente admin sem esta checagem.
 */
export async function requireAdmin() {
  const session = await requireRole("admin");
  return { ...session, db: createAdminClient() };
}
