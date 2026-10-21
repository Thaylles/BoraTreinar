import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const newAppToken = () => randomBytes(32).toString("base64url");
export const hashAppToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Confere o "Authorization: Bearer <token>" do app Android. Retorna o token e o dono, ou null. */
export async function appTokenFromRequest(req: Request) {
  const token = /^Bearer\s+([\w-]{20,100})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return null;
  const db = createAdminClient();
  const { data } = await db.from("app_tokens").select("id, user_id").eq("token_hash", hashAppToken(token)).maybeSingle();
  return data ? { db, tokenId: data.id, userId: data.user_id } : null;
}
