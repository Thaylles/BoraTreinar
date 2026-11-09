import type * as M from "@/app/admin/mobile-data";
import { callAction } from "./api";

/** Chama um carregador do admin no servidor (mesma checagem de admin do site). */
export async function adminData<K extends keyof typeof M>(fn: K, ...args: Parameters<(typeof M)[K]>): Promise<Awaited<ReturnType<(typeof M)[K]>>> {
  const r = await callAction<Awaited<ReturnType<(typeof M)[K]>>>(`admin/mobile-data#${fn}`, ...args);
  if (r.error || r.redirect) throw new Error(r.error ?? "Sem permissão de admin.");
  return r.result as Awaited<ReturnType<(typeof M)[K]>>;
}
