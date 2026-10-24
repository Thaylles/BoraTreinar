import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { PageTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { dayLabel } from "@/lib/schedule";
import { BACKDATE_MAX_DAYS, backdateDays } from "@/lib/session-window";
import { createClient } from "@/lib/supabase/server";
import { spDateKey, spTimeKey } from "@/lib/week";
import { BackdateForm } from "./backdate-form";

export const metadata: Metadata = { title: "Treino esquecido" };

export default async function RegistrarPassadoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { profile } = await requireRole("aluno");
  const erro = (await searchParams).erro;
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("workout_plans")
    .select("id, name")
    .eq("student_id", profile.id)
    .eq("is_template", false)
    .is("archived_at", null)
    .order("name");
  const today = spDateKey();
  const days = backdateDays(today).map((d) => ({ value: d, label: dayLabel(d, today) }));

  return (
    <>
      <Link href="/aluno" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Início
      </Link>
      <PageTitle sub={`Esqueceu de registrar? Lance aqui um treino dos últimos ${BACKDATE_MAX_DAYS} dias.`}>Treino esquecido</PageTitle>
      {erro && (
        <Alert className="mb-4">
          Só dá para registrar treinos de hoje até {BACKDATE_MAX_DAYS} dias atrás, sem horário no futuro. Escolha de novo.
        </Alert>
      )}
      <BackdateForm plans={plans ?? []} days={days} today={today} nowTime={spTimeKey()} />
    </>
  );
}
