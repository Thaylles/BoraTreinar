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
 * Chamado pelo banco (gatilho em notifications, via pg_net) a cada notificação nova:
 * envia o push para os aparelhos da pessoa. Protegido pelo segredo compartilhado.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  const given = request.headers.get("x-push-secret") ?? "";
  if (!secret || !sameSecret(given, secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const { data: n } = await createAdminClient().from("notifications").select("user_id, title, body, link").eq("id", id).maybeSingle();
  if (!n) return NextResponse.json({ sent: 0 });
  const sent = await sendPushToUser(n.user_id, { title: n.title, body: n.body, link: n.link, tag: id });
  return NextResponse.json({ sent });
}
