import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { exportFileName, planCsv } from "@/lib/plan-export";
import { attachment, loadExportPlan } from "@/lib/plan-export-server";

/** CSV da ficha (uma linha por série, com colunas em branco para anotar ?dias=1..8, padrão 4). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const plan = await loadExportPlan((await params).planId);
  if (!plan) return NextResponse.json({ error: "Ficha não encontrada." }, { status: 404 });
  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("dias") ?? 4) || 4, 1), 8);
  return new NextResponse(planCsv(plan, days), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": attachment(exportFileName(plan), "csv"),
      "Cache-Control": "private, no-store",
    },
  });
}
