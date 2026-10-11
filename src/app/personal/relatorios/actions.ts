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
