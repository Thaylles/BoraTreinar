import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Flame, Sparkles, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TrendChart } from "@/components/trend-chart";
import { WeeklyBars } from "./weekly-bars";
import { formatKg, shiftPeriod, type ExerciseProgress, type PeriodKind, type Totals } from "@/lib/stats";
import { mondayOf } from "@/lib/schedule";
import type { loadDashboard } from "@/lib/dashboard-server";
import { cn } from "@/lib/cn";

type Data = Awaited<ReturnType<typeof loadDashboard>>;

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const signed = (n: number, unit = "") => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR")}${unit}`;

function Compare({ now, before, unit = "" }: { now: number; before: number; unit?: string }) {
  const d = Math.round((now - before) * 10) / 10;
  if (!before && !now) return <span className="text-xs text-muted">—</span>;
  return (
    <span className={cn("text-xs font-semibold", d > 0 ? "text-bandeira-600 dark:text-bandeira-100" : d < 0 ? "text-pitanga-600" : "text-muted")}>
      {d === 0 ? "igual ao anterior" : `${signed(d, unit)} vs anterior`}
    </span>
  );
}

const TREND = {
  up: { icon: ArrowUpRight, cls: "bg-bandeira-50 text-bandeira-700 dark:bg-bandeira-500/20 dark:text-bandeira-100", text: "subiu" },
  same: { icon: ArrowRight, cls: "bg-border/50 text-muted", text: "estável" },
  down: { icon: ArrowDownRight, cls: "bg-pitanga-100 text-pitanga-600 dark:bg-pitanga-500/20", text: "caiu" },
  new: { icon: Sparkles, cls: "bg-ipe-100 text-anil-700 dark:bg-ipe-500/20 dark:text-ipe-400", text: "primeira vez" },
} as const;

function ProgressRow({ p, name, href }: { p: ExerciseProgress; name: string; href?: string }) {
  const t = TREND[p.trend];
  const Icon = t.icon;
  const body = (
    <>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", t.cls)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="text-xs text-muted">
          {p.previous === null ? "sem registro anterior" : `antes ${formatKg(p.previous)}`} · <span className="sr-only">tendência: </span>
          {t.text}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-display text-lg font-bold tabular-nums">{formatKg(p.current)}</span>
        {p.trend !== "new" && p.delta !== 0 && <span className="text-xs font-semibold tabular-nums">{signed(p.delta, " kg")}</span>}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-border/40">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 p-2">{body}</div>
      )}
    </li>
  );
}

function StatCard({ label, value, now, before, unit }: { label: string; value: string; now: number; before: number; unit?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="font-display text-2xl font-extrabold leading-tight tabular-nums">{value}</p>
      <Compare now={now} before={before} unit={unit} />
    </Card>
  );
}

/**
 * Dashboard semanal/mensal de um aluno (usado pelo aluno e pelos Personais).
 * `basePath` recebe `?periodo=&ref=`; `exerciseHref` leva ao histórico do exercício.
 */
export function DashboardView({
  data,
  basePath,
  exerciseHref,
  weightHiddenText,
}: {
  data: Data;
  basePath: string;
  exerciseHref?: (equipmentId: string) => string;
  weightHiddenText?: string;
}) {
  const { period, dashboard: d, names, today, weight } = data;
  const link = (kind: PeriodKind, ref: string) => `${basePath}?periodo=${kind}&ref=${ref}`;
  const isCurrent = today >= period.from && today <= period.to;
  const t: Totals = d.totals;
  const p: Totals = d.prevTotals;
  const nameOf = (id: string) => names[id] ?? "Exercício";
  const prevWord = period.kind === "semana" ? "semana anterior" : "mês anterior";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Período" className="grid grid-cols-2 gap-1 rounded-2xl bg-border/40 p-1 sm:w-64">
          {(
            [
              ["semana", "Semana"],
              ["mes", "Mês"],
            ] as const
          ).map(([k, label]) => (
            <Link
              key={k}
              role="tab"
              aria-selected={period.kind === k}
              href={link(k, period.kind === k ? period.from : today)}
              className={cn(
                "rounded-xl py-2 text-center text-sm font-bold transition",
                period.kind === k ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Link href={link(period.kind, shiftPeriod(period, -1))} className="rounded-xl p-2 hover:bg-border/50" aria-label="Período anterior">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <p className="text-center font-display text-lg font-bold">
            {period.label}
            {isCurrent && <span className="block text-xs font-normal text-muted">{period.kind === "semana" ? "esta semana" : "este mês"}</span>}
          </p>
          {isCurrent ? (
            <span className="size-9" aria-hidden />
          ) : (
            <Link href={link(period.kind, shiftPeriod(period, 1))} className="rounded-xl p-2 hover:bg-border/50" aria-label="Próximo período">
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3">
        <StatCard label="Treinos" value={String(t.sessions)} now={t.sessions} before={p.sessions} />
        <StatCard label="Volume total" value={formatKg(t.volume)} now={t.volume} before={p.volume} unit=" kg" />
        <StatCard label="Séries feitas" value={String(t.sets)} now={t.sets} before={p.sets} />
        <StatCard label="Tempo treinando" value={`${Math.floor(t.minutes / 60)}h${String(t.minutes % 60).padStart(2, "0")}`} now={t.minutes} before={p.minutes} unit=" min" />
      </section>
      <p className="-mt-3 text-xs text-muted">Comparação com a {prevWord}. Volume = séries feitas × repetições × carga.</p>

      <Card>
        <h2 className="mb-1 font-display text-lg font-bold">Frequência</h2>
        <p className="mb-2 text-xs text-muted">Treinos por semana (segunda a domingo), últimas 8 semanas.</p>
        <WeeklyBars weeks={d.weeks} current={mondayOf(period.to < today ? period.to : today)} />
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-lg font-bold">Evoluções notáveis</h2>
        <ul className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <Flame className="size-6 shrink-0 text-pitanga-500" aria-hidden />
            <span>
              {d.streakWeeks > 0 ? (
                <>
                  <strong>
                    {d.streakWeeks} {d.streakWeeks === 1 ? "semana" : "semanas seguidas"}
                  </strong>{" "}
                  treinando{d.streakWeeks >= 4 ? ". Que constância! 🔥" : ". Bora manter!"}
                </>
              ) : (
                "Sem sequência de semanas no momento. Bora começar uma?"
              )}
            </span>
          </li>
          {d.bestVolume && (
            <li className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-center text-xl" aria-hidden>
                💪
              </span>
              <span>
                Maior volume: <strong>{formatKg(d.bestVolume.volume)}</strong> em {ddmm(d.bestVolume.date)}
                {d.bestVolume.allTime && <strong className="text-bandeira-600 dark:text-bandeira-100"> · recorde de volume!</strong>}
              </span>
            </li>
          )}
          {d.prs.map((pr) => (
            <li key={pr.id} className="flex items-center gap-3">
              <Trophy className="size-6 shrink-0 text-ipe-600" aria-hidden />
              <span>
                Recorde em <strong>{nameOf(pr.id)}</strong>: {formatKg(pr.load)} ({ddmm(pr.date)})
              </span>
            </li>
          ))}
          {!d.bestVolume && !d.prs.length && <li className="text-muted">Nenhum treino neste período.</li>}
        </ul>
      </Card>

      {d.topGains.length > 0 && (
        <Card>
          <h2 className="mb-2 font-display text-lg font-bold">Onde mais aumentou carga</h2>
          <ol className="space-y-1">
            {d.topGains.map((g, i) => (
              <li key={g.id} className="flex items-center gap-3 py-1">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ipe-500 font-display font-extrabold text-anil-900">
                  {i + 1}º
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{nameOf(g.id)}</span>
                <span className="font-display font-bold tabular-nums text-bandeira-600 dark:text-bandeira-100">{signed(g.delta, " kg")}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 font-display text-lg font-bold">Progressão de carga</h2>
        <p className="mb-2 text-xs text-muted">Maior carga no período comparada com a última vez antes dele.</p>
        {d.progress.length ? (
          <ul className="-mx-2">
            {d.progress.map((pr) => (
              <ProgressRow key={pr.id} p={pr} name={nameOf(pr.id)} href={exerciseHref?.(pr.id)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhum exercício registrado neste período.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-display text-lg font-bold">Peso corporal</h2>
        {!weight.visible ? (
          <p className="text-sm text-muted">{weightHiddenText ?? "Nenhuma pesagem registrada ainda."}</p>
        ) : (
          <>
            <p className="mb-2 text-sm">
              {weight.change ? (
                weight.change.count > 1 ? (
                  <>
                    No período: <strong>{formatKg(weight.change.first)}</strong> → <strong>{formatKg(weight.change.last)}</strong> (
                    {signed(weight.change.delta, " kg")})
                  </>
                ) : (
                  <>
                    Pesagem do período: <strong>{formatKg(weight.change.last)}</strong>
                  </>
                )
              ) : (
                <span className="text-muted">Sem pesagem neste período.</span>
              )}
            </p>
            <TrendChart label="Peso" points={weight.points} emptyText="Duas pesagens ou mais nos últimos 4 meses mostram o gráfico." />
          </>
        )}
      </Card>
    </div>
  );
}
