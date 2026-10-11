import { Scale } from "lucide-react";
import { WeightForm } from "./weight-form";
import { shortDay, type WeighInStatus } from "@/lib/weight-server";
import { spDateKey } from "@/lib/week";

/** Tela da trava: explica o motivo e já traz o campo de peso. */
export function WeighInGate({ status, next }: { status: WeighInStatus; next: string }) {
  return (
    <div className="mx-auto max-w-md space-y-5 py-4">
      <div className="text-center">
        <span className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-ipe-500 text-anil-900">
          <Scale className="size-8" aria-hidden />
        </span>
        <h1 className="font-display text-3xl font-extrabold leading-tight">Hora da pesagem!</h1>
        <p className="mt-2 text-muted">
          {status.lastMeasuredOn
            ? `Sua última pesagem foi em ${shortDay(status.lastMeasuredOn)} e a frequência combinada é ${status.frequency}.`
            : "Você ainda não registrou seu peso."}{" "}
          Para iniciar o treino, registre seu peso de hoje. Leva 10 segundos. 💪
        </p>
      </div>
      <div className="rounded-3xl border border-border bg-surface p-5">
        <WeightForm next={next} today={spDateKey()} />
      </div>
      <p className="text-center text-xs text-muted">
        Você escolhe se o seu Personal pode ver o peso na aba <strong>Peso</strong>.
      </p>
    </div>
  );
}
