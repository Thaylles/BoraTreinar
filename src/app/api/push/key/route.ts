import { NextResponse } from "next/server";
import { vapidKeys } from "@/lib/push-server";

/** Chave pública VAPID para o navegador se inscrever no push (não é segredo). */
export function GET() {
  const keys = vapidKeys();
  if (!keys) return NextResponse.json({ publicKey: null }, { status: 503 });
  return NextResponse.json({ publicKey: keys.publicKey }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
