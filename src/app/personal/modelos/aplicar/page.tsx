import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Users } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BulkApplyForm } from "./bulk-apply-form";

export const metadata: Metadata = { title: "Aplicar a vários alunos" };

export default async function AplicarEmLotePage({ searchParams }: { searchParams: Promise<{ ficha?: string }> }) {
  const { profile } = await requireRole("personal");
  const { ficha } = await searchParams;
  const supabase = await createClient();
  const [{ data: templates }, { data: source }, { data: links }] = await Promise.all([
    supabase
      .from("workout_plans")
      .select("id, name, goal, items:workout_plan_items(count)")
      .eq("is_template", true)
      .eq("created_by", profile.id)
      .order("name"),
    ficha
      ? supabase
          .from("workout_plans")
          .select("id, name, goal, is_template, student:profiles!workout_plans_student_id_fkey(full_name), items:workout_plan_items(count)")
          .eq("id", ficha)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("personal_students")
      .select("student:profiles!personal_students_student_id_fkey(id, full_name)")
      .eq("personal_id", profile.id)
      .eq("status", "ativo")
      .is("archived_at", null),
  ]);

  const students = (links ?? [])
    .map((l) => l.student)
    .filter((s): s is { id: string; full_name: string } => !!s)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  const { data: active } = students.length
    ? await supabase
        .from("workout_plans")
        .select("student_id")
        .in("student_id", students.map((s) => s.id))
        .eq("is_template", false)
        .is("archived_at", null)
    : { data: [] };
  const activeOf = new Map<string, number>();
  for (const p of active ?? []) if (p.student_id) activeOf.set(p.student_id, (activeOf.get(p.student_id) ?? 0) + 1);

  const detail = (n: number, goal: string | null) => `${n} exercícios${goal ? ` · ${goal}` : ""}`;
  const plans = (templates ?? []).map((t) => ({ id: t.id, name: t.name, detail: `Modelo · ${detail(t.items[0]?.count ?? 0, t.goal)}` }));
  if (source && !source.is_template) {
    plans.unshift({
      id: source.id,
      name: source.name,
      detail: `Ficha de ${source.student?.full_name ?? "aluno"} · ${detail(source.items[0]?.count ?? 0, source.goal)}`,
    });
  }

  return (
    <>
      <Link
        href={source ? `/personal/fichas/${source.id}` : "/personal/modelos"}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> {source ? "Ficha" : "Modelos"}
      </Link>
      <PageTitle sub="Escolha as fichas e os alunos: cada aluno recebe uma cópia própria, que você pode ajustar depois.">
        Aplicar a vários alunos
      </PageTitle>
      {!plans.length ? (
        <EmptyState icon={<ClipboardList className="size-8" />} title="Nenhum modelo ainda">
          Crie modelos em Modelos ou use &quot;Salvar como modelo&quot; numa ficha.
        </EmptyState>
      ) : !students.length ? (
        <EmptyState icon={<Users className="size-8" />} title="Nenhum aluno ativo">
          Convide alunos para aplicar as fichas.
        </EmptyState>
      ) : (
        <BulkApplyForm plans={plans} students={students.map((s) => ({ id: s.id, name: s.full_name, activePlans: activeOf.get(s.id) ?? 0 }))} preselected={source ? [source.id] : []} />
      )}
    </>
  );
}
