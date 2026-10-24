import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { Card, PageTitle } from "@/components/ui/card";
import { MonthShare } from "@/components/dashboard/month-share";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthShareText, monthSummary } from "@/lib/month-summary";
import { addDays, addMonths, monthGrid } from "@/lib/schedule";
import { formatKg, type SummarySession } from "@/lib/stats";
import { spDateKey } from "@/lib/week";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Resumo do mês" };

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`);

export default async function ResumoMensalPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const [{ profile }, sp] = await Promise.all([requireStudent(), searchParams]);
  const today = spDateKey();
  const current = today.slice(0, 7);
  const month = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) && sp.mes <= current ? sp.mes : current;

  const supabase = await createClient();
  const { data } = await supabase.rpc("training_summary", {
    p_student: profile.id,
  });
  const sessions = (data ?? []) as unknown as SummarySession[];
  const ids = sessions.filter((s) => s.date.startsWith(month)).map((s) => s.id);
  const { data: cardioSets } = ids.length
    ? await supabase
        .from("session_sets")
        .select("duration_min, distance_km")
        .in("session_id", ids)
        .eq("done", true)
        .not("duration_min", "is", null)
    : { data: [] };
  const cardio = (cardioSets ?? []).reduce(
    (a, s) => ({
      minutes: a.minutes + Number(s.duration_min ?? 0),
      km: a.km + Number(s.distance_km ?? 0),
    }),
    { minutes: 0, km: 0 },
  );
  const summary = monthSummary(sessions, month, today, cardio);
  const prIds = summary.prs.map((p) => p.id);
  const { data: equipment } = prIds.length ? await supabase.from("equipment").select("id, name").in("id", prIds) : { data: [] };
  const names = Object.fromEntries((equipment ?? []).map((e) => [e.id, e.name]));

  const grid = monthGrid(month);
  const days = Array.from({ length: grid.days }, (_, i) => addDays(grid.start, i));
  const active = new Set(summary.activeDays);
  const first = sessions[0]?.date.slice(0, 7);
  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const diff = summary.sessions - summary.prevSessions;

  const stats = [
    { label: "dias treinados", value: String(summary.activeDays.length) },
    { label: "por semana", value: summary.perWeek.toLocaleString("pt-BR") },
    { label: "treinando", value: hours(summary.minutes) },
    { label: "levantados", value: formatKg(Math.round(summary.volume)) },
  ];

  return (
    <>
      <PageTitle sub="Seus treinos do mês, prontos para compartilhar.">Resumo do mês</PageTitle>

      <nav className="mb-4 flex items-center justify-between gap-2" aria-label="Escolher mês">
        {first && prevMonth >= first ? (
          <Link
            href={`/aluno/resumo?mes=${prevMonth}`}
            className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-semibold text-muted hover:bg-border/50"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" aria-hidden /> Anterior
          </Link>
        ) : (
          <span />
        )}
        <span className="font-display text-lg font-bold">{summary.label}</span>
        {nextMonth <= current ? (
          <Link
            href={`/aluno/resumo?mes=${nextMonth}`}
            className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-semibold text-muted hover:bg-border/50"
            aria-label="Próximo mês"
          >
            Próximo <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <section
        className="mb-4 rounded-3xl bg-gradient-to-br from-bandeira-500 to-bandeira-700 p-5 text-white shadow-lg"
        aria-label={`Resumo de ${summary.label}`}
      >
        <p className="text-sm font-semibold text-white/80">{summary.label}</p>
        <p className="font-display text-5xl font-extrabold leading-none tabular-nums">
          {summary.sessions} <span className="text-2xl">{summary.sessions === 1 ? "treino" : "treinos"}</span>
        </p>
        <p className="mt-1 text-sm text-white/85">
          {summary.prevSessions === 0 && summary.sessions === 0
            ? "Nenhum treino registrado neste mês."
            : diff === 0
              ? "Mesma quantidade do mês anterior."
              : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} em relação ao mês anterior${diff > 0 ? " 🔥" : ""}.`}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/12 px-3 py-2">
              <dt className="text-xs text-white/80">{s.label}</dt>
              <dd className="font-display text-xl font-extrabold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
        {summary.cardio.minutes > 0 && (
          <p className="mt-3 text-sm font-semibold">
            🏃 {summary.cardio.minutes} min de cardio
            {summary.cardio.km > 0 && ` · ${summary.cardio.km.toLocaleString("pt-BR")} km`}
          </p>
        )}
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px]" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="font-bold text-white/70">
              {d}
            </span>
          ))}
          {days.map((d) => (
            <span
              key={d}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg font-semibold tabular-nums",
                !d.startsWith(month) ? "opacity-0" : active.has(d) ? "bg-ipe-500 text-anil-900" : "bg-white/10 text-white/70",
              )}
            >
              {Number(d.slice(8))}
            </span>
          ))}
        </div>
      </section>

      <MonthShare summary={summary} names={names} text={monthShareText(summary, names)} />

      <Card className="mt-4">
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <Trophy className="size-5 text-ipe-500" aria-hidden /> Recordes do mês
        </h2>
        {summary.prs.length ? (
          <ul className="space-y-1 text-sm">
            {summary.prs.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5">
                <Link href={`/aluno/exercicios/${p.id}`} className="min-w-0 truncate font-semibold hover:underline">
                  {names[p.id] ?? "Exercício"}
                </Link>
                <span className="shrink-0 font-display font-bold tabular-nums">{formatKg(p.load)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhum recorde neste mês. Bora bater um no próximo treino!</p>
        )}
        {summary.topPlan && (
          <p className="mt-3 text-sm text-muted">
            Ficha mais treinada: <strong className="text-foreground">{summary.topPlan.name}</strong> ({summary.topPlan.count}×) ·{" "}
            {summary.weeksActive} {summary.weeksActive === 1 ? "semana" : "semanas"} com treino · {summary.sets} séries
          </p>
        )}
      </Card>
    </>
  );
}
