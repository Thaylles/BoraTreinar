import { NextResponse, type NextRequest } from "next/server";

// Agendado no vercel.json: "0 1 * * 1" (UTC) = domingo 22h em America/Sao_Paulo.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Implementado na etapa 10 (relatório de domingo).
  return NextResponse.json({ ok: true, enviados: 0 });
}
