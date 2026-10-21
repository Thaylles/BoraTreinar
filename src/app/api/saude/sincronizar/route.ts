import { NextResponse } from "next/server";
import { appTokenFromRequest } from "@/lib/health-connect/server";
import { HC_CATEGORIES, toExportItem, type ExportSet } from "@/lib/health-connect/shared";

/**
 * Sincronização do app Android com o Health Connect.
 * Recebe as atividades lidas no celular ({ items }) e devolve os treinos do BoraTreinar dos
 * últimos 30 dias para o app gravar no Health Connect ({ export }).
 */
export async function POST(req: Request) {
  const auth = await appTokenFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Conecte o app de novo pelo site (Perfil → Health Connect)." }, { status: 401 });
  const { db, tokenId, userId } = auth;

  const body = (await req.json().catch(() => null)) as { items?: unknown } | null;
  const raw = Array.isArray(body?.items) ? body.items.slice(0, 300) : [];
  const items = raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      id: String(x.id ?? "").slice(0, 120),
      category: HC_CATEGORIES.includes(x.category as never) ? String(x.category) : "outro",
      start: String(x.start ?? ""),
      end: String(x.end ?? ""),
      distance_m: typeof x.distance_m === "number" && Number.isFinite(x.distance_m) ? Math.max(0, x.distance_m) : null,
      title: typeof x.title === "string" ? x.title.slice(0, 60) : null,
      origin: typeof x.origin === "string" ? x.origin.slice(0, 60) : null,
    }))
    .filter((x) => x.id && x.start && x.end);

  let imported = 0;
  if (items.length) {
    const { data, error } = await db.rpc("import_health_sessions", { p_student: userId, p_items: items });
    if (error) return NextResponse.json({ error: "Não foi possível importar as atividades." }, { status: 500 });
    imported = data ?? 0;
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: sessions } = await db
    .from("workout_sessions")
    .select("id, plan_name, started_at, finished_at, imported_from, sets:session_sets(done, distance_km, equipment:equipment!session_sets_equipment_id_fkey(name, muscle_group))")
    .eq("student_id", userId)
    .gte("started_at", since)
    .order("started_at")
    .limit(200);
  const exportItems = (sessions ?? [])
    .filter((s) => !s.imported_from)
    .map((s) => toExportItem({ ...s, sets: s.sets as unknown as ExportSet[] }))
    .filter((x) => x !== null);

  await db
    .from("app_tokens")
    .update({ last_sync_at: new Date().toISOString(), last_imported: imported, last_exported: exportItems.length })
    .eq("id", tokenId);
  return NextResponse.json({ imported, export: exportItems });
}
