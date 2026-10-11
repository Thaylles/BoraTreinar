import type { Metadata } from "next";
import { CalendarClock, Lock, Trash2, Unlock } from "lucide-react";
import { Card, PageTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { TrendChart } from "@/components/trend-chart";
import { WeightForm } from "@/components/weight/weight-form";
import { WeightSettingsForm } from "@/components/weight/weight-settings-form";
import { requireRole } from "@/lib/auth";
import { spDateKey } from "@/lib/week";
import { getStudentSettings, getWeighInStatus, listWeights, shortDay } from "@/lib/weight-server";
import { deleteWeight } from "./actions";

export const metadata: Metadata = { title: "Peso" };

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default async function PesoPage() {
  const { profile } = await requireRole("aluno");
  const [status, weights, settings] = await Promise.all([
    getWeighInStatus(profile.id),
    listWeights(profile.id),
    getStudentSettings(profile.id),
  ]);
  const last = weights[0];
  const first = weights[weights.length - 1];
  const diff = last && first && last !== first ? last.weight_kg - first.weight_kg : null;

  return (
    <>
      <PageTitle sub="Acompanhe seu peso e escolha quem pode ver.">Peso corporal</PageTitle>

      {status.overdue ? (
        <Alert className="mb-4">
          Pesagem vencida: registre seu peso para liberar os treinos.
        </Alert>
      ) : (
        <Alert kind="success" className="mb-4">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-4" aria-hidden /> Pesagem em dia. Próxima até {status.dueOn ? shortDay(status.dueOn) : "—"}.
          </span>
        </Alert>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Último peso{last && ` · ${shortDay(last.measured_on)}`}</p>
          <p className="font-display text-3xl font-extrabold">{last ? `${fmt(last.weight_kg)} kg` : "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Variação no período</p>
          <p className="font-display text-3xl font-extrabold">
            {diff == null ? "—" : `${diff > 0 ? "+" : ""}${fmt(diff)} kg`}
          </p>
        </Card>
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 font-display text-lg font-bold">Registrar peso</h2>
        <WeightForm today={spDateKey()} lastKg={last?.weight_kg} />
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 font-display text-lg font-bold">Evolução</h2>
        <TrendChart
          label="Peso"
          emptyText="Registre pelo menos duas pesagens para ver o gráfico."
          points={[...weights].reverse().map((w) => ({ date: w.measured_on, value: w.weight_kg }))}
        />
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          {settings.weightVisible ? <Unlock className="size-5" aria-hidden /> : <Lock className="size-5" aria-hidden />}
          Privacidade e frequência
        </h2>
        <WeightSettingsForm visible={settings.weightVisible} frequency={settings.frequency} />
      </Card>

      {!!weights.length && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold">Histórico</h2>
          <ul className="divide-y divide-border rounded-3xl border border-border bg-surface">
            {weights.map((w) => (
              <li key={w.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted">{shortDay(w.measured_on)}/{w.measured_on.slice(0, 4)}</span>
                <span className="font-semibold">{fmt(w.weight_kg)} kg</span>
                <form action={deleteWeight}>
                  <input type="hidden" name="id" value={w.id} />
                  <ConfirmSubmit message="Excluir esta pesagem?" className="rounded-lg p-1.5 text-muted hover:text-pitanga-600">
                    <Trash2 className="size-4" aria-label="Excluir pesagem" />
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
