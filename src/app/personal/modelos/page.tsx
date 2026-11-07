import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, Plus, Users } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Modelos de ficha" };

export default async function ModelosPage({ searchParams }: { searchParams: Promise<{ prontos?: string }> }) {
  const sp = await searchParams;
  const { profile } = await requireRole("personal");
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("workout_plans")
    .select("id, name, goal, items:workout_plan_items(count)")
    .eq("is_template", true)
    .eq("created_by", profile.id)
    .order("name");

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageTitle sub="Fichas prontas para aplicar nos seus alunos.">Modelos</PageTitle>
        <LinkButton href="/personal/modelos/novo" size="sm" className="mt-1 shrink-0">
          <Plus className="size-4" aria-hidden /> Novo
        </LinkButton>
      </div>
      {sp.prontos !== undefined && (
        <Alert kind="success" className="mb-4">
          {Number(sp.prontos) > 0 ? `${sp.prontos} modelos criados a partir dos treinos prontos ✅` : "Esses treinos prontos já estão nos seus modelos."}
        </Alert>
      )}
      <Link
        href="/personal/treinos-prontos"
        className="mb-4 flex items-center gap-3 rounded-3xl border-2 border-dashed border-bandeira-500 p-4 text-sm transition hover:bg-bandeira-50 dark:hover:bg-bandeira-500/10"
      >
        <span className="text-2xl" aria-hidden>📚</span>
        <span className="flex-1">
          <span className="block font-display text-base font-bold">Treinos prontos por nível</span>
          <span className="text-muted">4 treinos de iniciante, intermediário e avançado para copiar como modelos.</span>
        </span>
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </Link>
      {!!templates?.length && (
        <LinkButton href="/personal/modelos/aplicar" variant="secondary" className="mb-4 w-full">
          <Users className="size-5" aria-hidden /> Aplicar a vários alunos
        </LinkButton>
      )}
      {!templates?.length ? (
        <EmptyState icon={<ClipboardList className="size-8" />} title="Nenhum modelo ainda">
          Crie um aqui ou use &quot;Salvar como modelo&quot; em qualquer ficha.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/personal/fichas/${t.id}`}>
                <Card className="flex items-center gap-3 p-4 transition hover:border-bandeira-500">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-muted">
                      {t.items[0]?.count ?? 0} exercícios{t.goal && ` · ${t.goal}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted" aria-hidden />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
