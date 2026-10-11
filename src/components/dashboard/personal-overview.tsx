import Link from "next/link";
import { ChevronRight, Moon, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatKg, periodFor, type PeriodKind } from "@/lib/stats";
import { daysAgoLabel, daysAgoSP, spDateKey, spMidnightISO } from "@/lib/week";
import { cn } from "@/lib/cn";

type OverviewRow = { student_id: string; sessions: number; volume: number; last_at: string | null };

const INACTIVE_DAYS = 7;
const MEDALS = ["🥇", "🥈", "🥉"];

/** Visão geral do Personal: ranking de frequência e alunos sem treinar. */
export async function PersonalOverview({ personalId, kind }: { personalId: string; kind: PeriodKind }) {
  const supabase = await createClient();
  const period = periodFor(kind, spDateKey());
  const [{ data: links }, { data: overview }] = await Promise.all([
    supabase
      .from("personal_students")
      .select("student:profiles!personal_students_student_id_fkey(id, full_name)")
      .eq("personal_id", personalId)
      .eq("status", "ativo")
      .is("archived_at", null),
    supabase.rpc("training_overview", { p_since: spMidnightISO(period.from) }),
  ]);
  const stats = new Map(((overview ?? []) as unknown as OverviewRow[]).map((r) => [r.student_id, r]));
  const students = (links ?? [])
    .map((l) => l.student)
    .filter((s): s is { id: string; full_name: string } => !!s)
    .map((s) => {
      const r = stats.get(s.id);
      return {
        ...s,
        sessions: Number(r?.sessions ?? 0),
        volume: Number(r?.volume ?? 0),
        daysAgo: r?.last_at ? daysAgoSP(r.last_at) : null,
      };
    });
  if (!students.length) return null;

  const ranking = [...students].sort((a, b) => b.sessions - a.sessions || b.volume - a.volume || a.full_name.localeCompare(b.full_name, "pt-BR"));
  const inactive = students
    .filter((s) => s.daysAgo === null || s.daysAgo >= INACTIVE_DAYS)
    .sort((a, b) => (b.daysAgo ?? 99_999) - (a.daysAgo ?? 99_999));
  const total = students.reduce((a, s) => a + s.sessions, 0);
  const active = students.filter((s) => s.sessions > 0).length;

  return (
    <section aria-labelledby="visao-geral" className="mb-8 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="visao-geral" className="font-display text-xl font-bold">
          Visão geral
        </h2>
        <div role="tablist" aria-label="Período" className="grid grid-cols-2 gap-1 rounded-2xl bg-border/40 p-1">
          {(
            [
              ["semana", "Semana"],
              ["mes", "Mês"],
            ] as const
          ).map(([k, label]) => (
            <Link
              key={k}
              role="tab"
              aria-selected={kind === k}
              href={k === "semana" ? "/personal" : "/personal?visao=mes"}
              scroll={false}
              className={cn(
                "rounded-xl px-3 py-1.5 text-center text-sm font-bold transition",
                kind === k ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <p className="-mt-2 text-sm text-muted">
        {kind === "semana" ? "Nesta semana (seg–dom)" : `Em ${period.label.toLowerCase()}`}: <strong className="text-foreground">{total}</strong>{" "}
        {total === 1 ? "treino" : "treinos"}, <strong className="text-foreground">{active}</strong> de {students.length}{" "}
        {students.length === 1 ? "aluno treinou" : "alunos treinaram"}.
      </p>

      <Card>
        <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <Trophy className="size-5 text-ipe-600" aria-hidden /> Ranking de frequência
        </h3>
        <ol className="-mx-2">
          {ranking.map((s, i) => (
            <li key={s.id}>
              <Link href={`/personal/alunos/${s.id}/evolucao?periodo=${kind}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-border/40">
                <span className="w-7 shrink-0 text-center font-display font-bold text-muted" aria-label={`${i + 1}º lugar`}>
                  {s.sessions > 0 && i < 3 ? MEDALS[i] : `${i + 1}º`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.full_name}</span>
                  <span className="text-xs text-muted">{s.volume > 0 ? `${formatKg(s.volume)} de volume` : "sem volume no período"}</span>
                </span>
                <span className="font-display text-xl font-extrabold tabular-nums">{s.sessions}</span>
                <ChevronRight className="size-4 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <Moon className="size-5 text-anil-500" aria-hidden /> Sem treinar há {INACTIVE_DAYS}+ dias
        </h3>
        {inactive.length ? (
          <ul className="-mx-2">
            {inactive.map((s) => (
              <li key={s.id}>
                <Link href={`/personal/alunos/${s.id}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-border/40">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.full_name}</span>
                  <span className="shrink-0 rounded-full bg-pitanga-100 px-2 py-0.5 text-xs font-bold text-pitanga-600 dark:bg-pitanga-500/20">
                    {s.daysAgo === null ? "nunca treinou" : daysAgoLabel(s.daysAgo)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Todo mundo treinou nos últimos {INACTIVE_DAYS} dias. Mandou bem! 🎉</p>
        )}
      </Card>
    </section>
  );
}
