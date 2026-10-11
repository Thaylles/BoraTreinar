import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { exportFileName, planPdf } from "@/lib/plan-export";
import { attachment, loadExportPlan } from "@/lib/plan-export-server";
import { spDateKey } from "@/lib/week";

/** PDF da ficha + folha de registro para preencher à mão (?dias=1..8, padrão 5). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const plan = await loadExportPlan((await params).planId);
  if (!plan) return NextResponse.json({ error: "Ficha não encontrada." }, { status: 404 });
  const days = Number(request.nextUrl.searchParams.get("dias") ?? 5) || 5;
  const today = spDateKey();
  const pdf = await planPdf(plan, { days, generatedAt: `${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}` });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachment(exportFileName(plan), "pdf"),
      "Cache-Control": "private, no-store",
    },
  });
}
