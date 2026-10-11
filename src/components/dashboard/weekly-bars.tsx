"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDark } from "@/components/trend-chart";

type Week = { week: string; sessions: number; volume: number };

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Treinos por semana (seg–dom); a semana do período fica destacada. */
export function WeeklyBars({ weeks, current }: { weeks: Week[]; current: string }) {
  const dark = useDark();
  const base = dark ? "#1DA857" : "#009C3B";
  const faded = dark ? "#1DA85766" : "#009C3B55";
  const surface = dark ? "#13203a" : "#ffffff";
  const ink = dark ? "#a5adbd" : "#5b6577";
  const total = weeks.reduce((a, w) => a + w.sessions, 0);
  return (
    <div
      className="h-44 w-full"
      role="img"
      aria-label={`Treinos por semana nas últimas ${weeks.length} semanas: ${weeks.map((w) => `${ddmm(w.week)}: ${w.sessions}`).join(", ")}. Total ${total}.`}
    >
      <ResponsiveContainer>
        <BarChart data={weeks} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} stroke={ink} strokeOpacity={0.15} />
          <XAxis dataKey="week" tickFormatter={ddmm} tick={{ fill: ink, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: ink, fillOpacity: 0.08 }}
            contentStyle={{ background: surface, border: `1px solid ${ink}40`, borderRadius: 12, fontSize: 12 }}
            labelFormatter={(w) => `Semana de ${ddmm(String(w))}`}
            formatter={(v, _n, item) => [
              `${v} ${Number(v) === 1 ? "treino" : "treinos"} · ${Number((item.payload as Week).volume).toLocaleString("pt-BR")} kg`,
              "Frequência",
            ]}
          />
          <Bar dataKey="sessions" radius={[6, 6, 0, 0]} isAnimationActive={false} maxBarSize={28}>
            {weeks.map((w) => (
              <Cell key={w.week} fill={w.week === current ? base : faded} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
