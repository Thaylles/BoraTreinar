import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { PlanEditor } from "@/components/plans/plan-editor";
import { loadCautions } from "@/lib/health-server";
import { requireRole } from "@/lib/auth";
import { loadCatalogFor } from "@/lib/plans-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nova ficha" };

export default async function NovaFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("personal");
  const supabase = await createClient();
  const [{ data: student }, { count }, catalog] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", id).in("role", ["aluno", "admin"]).maybeSingle(),
    supabase.from("workout_plans").select("id", { count: "exact", head: true }).eq("student_id", id).is("archived_at", null),
    loadCatalogFor(id),
  ]);
  if (!student) notFound();
  const letter = String.fromCharCode(65 + Math.min(count ?? 0, 25));

  return (
    <>
      <Link href={`/personal/alunos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {student.full_name}
      </Link>
      <PageTitle sub={`Para ${student.full_name}`}>Nova ficha</PageTitle>
      <PlanEditor
        cautions={await loadCautions(id)}
        catalog={catalog}
        initial={{ planId: null, studentId: id, name: `Treino ${letter}`, goal: "", notes: "", validUntil: "", items: [] }}
      />
    </>
  );
}
