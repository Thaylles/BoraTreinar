import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { needsClearance, type HealthForm } from "@/lib/health";
import { formatDate } from "@/lib/format";
import { HealthFormView } from "./health-form";
import { ClearanceUpload } from "./clearance-upload";

export const metadata: Metadata = { title: "Anamnese" };

export default async function SaudePage() {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const { data } = await supabase.from("health_forms").select("*").eq("student_id", profile.id).maybeSingle();
  const form = data as HealthForm | null;
  const signed = form?.clearance_path
    ? (await supabase.storage.from("medical").createSignedUrl(form.clearance_path, 600)).data?.signedUrl ?? null
    : null;
  return (
    <>
      <Link href="/aluno" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Início
      </Link>
      <PageTitle sub="Leva uns 2 minutos e ajuda seu Personal a montar treinos seguros para você.">Anamnese 🩺</PageTitle>
      {form?.updated_at && <p className="-mt-3 mb-4 text-xs text-muted">Última atualização: {formatDate(form.updated_at)}</p>}

      {form && needsClearance(form) && (
        <section className="mb-6 rounded-3xl border-2 border-pitanga-500/60 bg-pitanga-100/50 p-4 dark:bg-pitanga-500/10">
          <p className="font-display text-lg font-bold">📄 Liberação médica</p>
          <p className="mb-3 text-sm">
            Você respondeu “sim” em alguma pergunta do PAR-Q. Antes de intensificar os treinos, converse com um médico e envie aqui a
            liberação para a prática de atividade física.
          </p>
          <ClearanceUpload userId={profile.id} hasFile={!!form.clearance_path} url={signed} />
        </section>
      )}

      <HealthFormView initial={form} />
    </>
  );
}
