import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OpenRequest = { key: string; name: string; count: number; notes: string[]; since: string };

/** Pedidos de exercício em aberto, agrupados pelo nome (Personais e admins). */
export async function loadOpenRequests(): Promise<OpenRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise_requests")
    .select("name, name_key, note, created_at")
    .eq("status", "aberto")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return []; // banco ainda sem a tabela de pedidos
  const groups = new Map<string, OpenRequest>();
  for (const r of data ?? []) {
    const g = groups.get(r.name_key) ?? { key: r.name_key, name: r.name, count: 0, notes: [], since: r.created_at };
    g.count += 1;
    if (r.note && g.notes.length < 3) g.notes.push(r.note);
    if (r.created_at < g.since) g.since = r.created_at;
    groups.set(r.name_key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.since.localeCompare(b.since));
}
