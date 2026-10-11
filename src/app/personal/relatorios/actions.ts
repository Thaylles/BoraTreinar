"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateWeeklyReports } from "@/lib/report-server";
import { periodFor } from "@/lib/stats";
import { spDateKey } from "@/lib/week";

/** Gera agora o relatório desta semana (prévia: sem e-mail). O de domingo 22h substitui pelo final. */
export async function generateReportNow() {
  const { profile } = await requireRole("personal");
  await generateWeeklyReports({ personalId: profile.id, deliver: false });
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_reports")
    .select("id")
    .eq("week_start", periodFor("semana", spDateKey()).from)
    .maybeSingle();
  revalidatePath("/personal/relatorios");
  redirect(data ? `/personal/relatorios/${data.id}` : "/personal/relatorios");
}

const SOURCES = ["regras", "gemini", "claude"] as const;

/** Marca qual conjunto de sugestões foi mais útil neste relatório (para comparar regras × IAs). */
export async function setPreferredSource(fd: FormData) {
  await requireRole("personal");
  const id = String(fd.get("report_id") ?? "");
  const raw = String(fd.get("source") ?? "");
  const source = (SOURCES as readonly string[]).includes(raw) ? raw : null;
  const supabase = await createClient();
  await supabase.from("weekly_reports").update({ preferred_source: source }).eq("id", id);
  revalidatePath("/personal/relatorios");
  revalidatePath(`/personal/relatorios/${id}`);
}
