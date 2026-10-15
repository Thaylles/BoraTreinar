import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { AchievementsView, type AchievementFilter } from "@/components/achievements/achievements-view";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conquistas do aluno" };

const FILTERS = ["todas", "conquistadas", "faltam", "secretas"];

export default async function StudentAchievementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filtro?: string }>;
}) {
  await requireRole("personal");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const filter = (FILTERS.includes(sp.filtro ?? "") ? sp.filtro : "todas") as AchievementFilter;
  const supabase = await createClient();
  const [{ data: student }, { data, error }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", id).maybeSingle(),
    supabase.rpc("my_achievements", { p_student: id }),
  ]);
  if (!student || error) notFound();
  return (
    <>
      <Link href={`/personal/alunos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {student.full_name}
      </Link>
      <PageTitle sub="As secretas só aparecem depois que o aluno libera.">Conquistas</PageTitle>
      <AchievementsView rows={data ?? []} filter={filter} basePath={`/personal/alunos/${id}/conquistas`} />
    </>
  );
}
