import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { PageTitle } from "@/components/ui/card";
import { BackdateForm } from "@/components/workout/backdate-form";
import { requireRole } from "@/lib/auth";
import { firstName } from "@/lib/format";
import { dayLabel } from "@/lib/schedule";
import { BACKDATE_MAX_DAYS, backdateDays } from "@/lib/session-window";
import { createClient } from "@/lib/supabase/server";
import { spDateKey, spTimeKey } from "@/lib/week";

export const metadata: Metadata = { title: "Treino esquecido" };

export default async function PersonalRegistrarPassadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const [{ id }, { erro }] = await Promise.all([params, searchParams]);
  await requireRole("personal");
  const supabase = await createClient();
  const [{ data: student }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", id).maybeSingle(),
    supabase
      .from("workout_plans")
      .select("id, name")
      .eq("student_id", id)
      .eq("is_template", false)
      .is("archived_at", null)
      .order("name"),
  ]);
  if (!student) notFound();
  const today = spDateKey();
  const days = backdateDays(today).map((d) => ({ value: d, label: dayLabel(d, today) }));

  return (
    <>
      <Link href={`/personal/alunos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {student.full_name}
      </Link>
      <PageTitle sub={`Lance um treino de ${firstName(student.full_name)} dos últimos ${BACKDATE_MAX_DAYS} dias que ficou sem registro.`}>
        Treino esquecido
      </PageTitle>
      {erro && (
        <Alert className="mb-4">
          Só dá para registrar treinos de hoje até {BACKDATE_MAX_DAYS} dias atrás, sem horário no futuro. Escolha de novo.
        </Alert>
      )}
      {plans?.length ? (
        <BackdateForm
          plans={plans}
          days={days}
          today={today}
          nowTime={spTimeKey()}
          planBase={`/personal/alunos/${id}/registrar`}
          who={firstName(student.full_name)}
        />
      ) : (
        <p className="text-sm text-muted">Monte uma ficha para o aluno antes de registrar um treino.</p>
      )}
    </>
  );
}
