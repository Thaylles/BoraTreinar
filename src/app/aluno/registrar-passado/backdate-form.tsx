"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

const DURATIONS = [20, 30, 40, 45, 50, 60, 75, 90, 120];

/** Escolhe a ficha (ou treino livre), o dia, o horário de início e a duração do treino que já aconteceu. */
export function BackdateForm({
  plans,
  days,
  today,
  nowTime,
}: {
  plans: { id: string; name: string }[];
  days: { value: string; label: string }[];
  today: string;
  nowTime: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(plans[0]?.id ?? "livre");
  const [day, setDay] = useState(days[1]?.value ?? today);
  const [time, setTime] = useState("18:00");
  const [minutes, setMinutes] = useState(60);
  const future = day === today && time > nowTime;

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (future) return;
    const q = `passado=${day}T${time}&min=${minutes}`;
    router.push(plan === "livre" ? `/aluno/livre?${q}` : `/aluno/treinar/${plan}?${q}`);
  }

  return (
    <form onSubmit={go} className="space-y-4 rounded-3xl border border-border bg-surface p-4">
      <label className="block space-y-1.5 text-sm font-semibold">
        <span className="block">O que você treinou?</span>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="livre">Treino livre (escolher os exercícios)</option>
        </select>
      </label>
      <label className="block space-y-1.5 text-sm font-semibold">
        <span className="block">Dia</span>
        <select value={day} onChange={(e) => setDay(e.target.value)} className={inputClass}>
          {days.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
              {d.label === "Hoje" || d.label === "Ontem" ? `, ${d.value.slice(8, 10)}/${d.value.slice(5, 7)}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 space-y-1.5 text-sm font-semibold">
          <span className="block">Começou às</span>
          <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </label>
        <label className="min-w-0 space-y-1.5 text-sm font-semibold">
          <span className="block">Duração</span>
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={inputClass}>
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {future && <p className="text-sm font-semibold text-pitanga-600">Esse horário ainda não chegou hoje.</p>}
      <p className="text-xs text-muted">
        Na próxima tela, marque as séries que você fez (com carga e repetições) e finalize. Se o treino foi só cardio, a duração
        vira o tempo do cardio.
      </p>
      <Button type="submit" size="lg" className="w-full" disabled={future}>
        <CalendarClock className="size-5" aria-hidden /> Continuar
      </Button>
    </form>
  );
}
