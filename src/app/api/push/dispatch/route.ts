import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push-server";

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Chamado pelo banco (gatilho em notifications, via pg_net) a cada notificação nova.
 * Só envia notificações criadas há menos de 2 minutos e ainda não enviadas: marca pushed_at
 * de forma atômica, então repetir a chamada (ou chamá-la de fora) não reenvia nada.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (secret && !sameSecret(request.headers.get("x-push-secret") ?? "", secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const { data: n } = await createAdminClient()
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", id)
    .is("pushed_at", null)
    .gte("created_at", new Date(Date.now() - 2 * 60_000).toISOString())
    .select("user_id, title, body, link")
    .maybeSingle();
  if (!n) return NextResponse.json({ sent: 0 });
  const sent = await sendPushToUser(n.user_id, { title: n.title, body: n.body, link: n.link, tag: id });
  return NextResponse.json({ sent });
}
