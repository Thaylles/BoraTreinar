import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { healthSurvey, needsClearance, type HealthForm } from "@/lib/health";

export const metadata: Metadata = { title: "Levantamento de saúde" };

function Bars({ items, total }: { items: { value: string; label: string; n: number }[]; total: number }) {
  if (!items.length) return <p className="text-sm text-muted">Ninguém marcou.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((x) => (
        <li key={x.value} className="text-sm">
          <div className="flex justify-between gap-2">
            <span>{x.label}</span>
            <span className="font-semibold tabular-nums">
              {x.n} <span className="text-xs font-normal text-muted">({Math.round((x.n / total) * 100)}%)</span>
            </span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-border/60">
            <div className="h-full rounded-full bg-bandeira-500" style={{ width: `${(x.n / total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Levantamento das anamneses dos alunos ativos do Personal (respostas padronizadas). */
export default async function SaudePage() {
  const { profile } = await requireRole("personal");
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("personal_students")
    .select("student_id, student:profiles!personal_students_student_id_fkey(full_name)")
    .eq("personal_id", profile.id)
    .eq("status", "ativo")
    .is("archived_at", null);
  const ids = (links ?? []).map((l) => l.student_id).filter((id) => id !== profile.id);
  const { data } = ids.length ? await supabase.from("health_forms").select("*").in("student_id", ids) : { data: [] };
  const forms = (data ?? []) as (HealthForm & { student_id: string })[];
  const s = healthSurvey(forms);
  const nameOf = (id: string) => links?.find((l) => l.student_id === id)?.student?.full_name ?? "Aluno";
  const missing = ids.filter((id) => !forms.some((f) => f.student_id === id));
  const atRisk = forms.filter(needsClearance);

  return (
    <>
      <Link href="/personal/alunos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Alunos
      </Link>
      <PageTitle sub={`${s.total} de ${ids.length} alunos ativos preencheram a anamnese.`}>Levantamento de saúde 🩺</PageTitle>

      {!!atRisk.length && (
        <section className="mb-4 rounded-3xl border-2 border-pitanga-500/60 bg-pitanga-100/50 p-4 dark:bg-pitanga-500/10">
          <p className="mb-2 font-display text-lg font-bold">⚠️ PAR-Q com “sim” ({atRisk.length})</p>
          <ul className="space-y-1 text-sm">
            {atRisk.map((f) => (
              <li key={f.student_id}>
                <Link href={`/personal/alunos/${f.student_id}`} className="font-semibold hover:underline">
                  {nameOf(f.student_id)}
                </Link>{" "}
                · {f.clearance_path ? "✅ liberação enviada" : "📄 sem liberação médica"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!missing.length && (
        <section className="mb-4 rounded-3xl border border-dashed border-border p-4 text-sm">
          <p className="mb-1 font-bold">Ainda não preencheram ({missing.length})</p>
          <p className="text-muted">{missing.map(nameOf).join(", ")}</p>
        </section>
      )}

      {s.total > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl border border-border bg-surface p-4">
            <h2 className="mb-2 font-display font-bold">PAR-Q: perguntas com “sim”</h2>
            <Bars items={s.parq} total={s.total} />
          </section>
          {s.multi.map((q) => (
            <section key={q.key} className="rounded-3xl border border-border bg-surface p-4">
              <h2 className="mb-2 font-display font-bold">{q.title}</h2>
              <Bars items={q.counts} total={s.total} />
            </section>
          ))}
          {s.single.map((q) => (
            <section key={q.key} className="rounded-3xl border border-border bg-surface p-4">
              <h2 className="mb-2 font-display font-bold">{q.title}</h2>
              <Bars items={q.counts} total={s.total} />
            </section>
          ))}
          <section className="rounded-3xl border border-border bg-surface p-4">
            <h2 className="mb-2 font-display font-bold">Fumantes</h2>
            <Bars items={s.smokers ? [{ value: "sim", label: "Fumam", n: s.smokers }] : []} total={s.total} />
          </section>
        </div>
      )}
    </>
  );
}
