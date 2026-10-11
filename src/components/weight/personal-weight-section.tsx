import { Lock, Scale } from "lucide-react";
import { TrendChart } from "@/components/trend-chart";
import { Badge } from "@/components/ui/card";
import { getStudentSettings, getWeighInStatus, listWeights, shortDay } from "@/lib/weight-server";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * Peso do aluno visto pelo Personal. O RLS só devolve pesagens quando o aluno permitiu;
 * sem permissão mostramos apenas a situação da pesagem (datas), nunca o valor.
 */
export async function PersonalWeightSection({ studentId }: { studentId: string }) {
  const [settings, status, weights] = await Promise.all([
    getStudentSettings(studentId),
    getWeighInStatus(studentId),
    listWeights(studentId, 30),
  ]);
  const visible = settings.weightVisible && weights.length > 0;
  const last = weights[0];
  const prev = weights[1];
  const diff = visible && prev ? last.weight_kg - prev.weight_kg : null;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Scale className="size-5" aria-hidden /> Peso
        </h2>
        {status.overdue ? <Badge tone="red">Pesagem vencida</Badge> : <Badge tone="green">Pesagem em dia</Badge>}
      </div>
      <p className="mb-3 text-sm text-muted">
        Frequência {status.frequency}
        {status.lastMeasuredOn ? ` · última pesagem em ${shortDay(status.lastMeasuredOn)}` : " · nunca se pesou"}
      </p>

      {!settings.weightVisible ? (
        <p className="flex items-center gap-2 rounded-2xl bg-border/40 p-4 text-sm text-muted">
          <Lock className="size-4 shrink-0" aria-hidden /> O aluno optou por não compartilhar o peso.
        </p>
      ) : !visible ? (
        <p className="text-sm text-muted">Nenhuma pesagem registrada ainda.</p>
      ) : (
        <div className="rounded-3xl border border-border bg-surface p-4">
          <p className="font-display text-3xl font-extrabold">
            {fmt(last.weight_kg)} kg
            {diff != null && (
              <span className="ml-2 text-base font-semibold text-muted">
                ({diff > 0 ? "+" : ""}
                {fmt(diff)} kg desde {shortDay(prev.measured_on)})
              </span>
            )}
          </p>
          <TrendChart
            label="Peso"
            emptyText="Ainda há poucas pesagens para o gráfico."
            points={[...weights].reverse().map((w) => ({ date: w.measured_on, value: w.weight_kg }))}
          />
        </div>
      )}
    </section>
  );
}
