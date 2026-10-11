import { NextResponse, type NextRequest } from "next/server";
import { generateWeeklyReports } from "@/lib/report-server";

// A IA e os e-mails podem levar alguns segundos por Personal.
export const maxDuration = 60;

// Agendado no vercel.json: "0 1 * * 1" (UTC) = domingo 22h em America/Sao_Paulo.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const result = await generateWeeklyReports({ deliver: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
