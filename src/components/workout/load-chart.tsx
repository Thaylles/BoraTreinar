"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; maxLoad: number; pr: boolean };

// Cores validadas (contraste ≥ 3:1 sobre a superfície) para claro/escuro.
const SERIES = { light: "#009C3B", dark: "#1DA857" };
const PR = "#E6A800";

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** Evolução da maior carga por treino. Recordes ganham marcador maior com anel amarelo. */
export function LoadChart({ points }: { points: Point[] }) {
  const dark = useDark();
  const color = dark ? SERIES.dark : SERIES.light;
  const surface = dark ? "#13203a" : "#ffffff";
  const ink = dark ? "#a5adbd" : "#5b6577";

  if (points.length < 2) {
    return <p className="py-6 text-center text-sm text-muted">Registre pelo menos dois treinos para ver o gráfico de evolução.</p>;
  }

  return (
    <div className="h-56 w-full" role="img" aria-label="Gráfico da maior carga por treino">
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 12, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid vertical={false} stroke={ink} strokeOpacity={0.15} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} width={44} unit="kg" domain={["dataMin - 5", "dataMax + 5"]} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: ink, strokeOpacity: 0.4, strokeDasharray: "3 3" }}
            contentStyle={{ background: surface, border: `1px solid ${ink}40`, borderRadius: 12, fontSize: 12 }}
            labelFormatter={(d) => shortDate(String(d))}
            formatter={(v, _n, item) => [`${Number(v).toLocaleString("pt-BR")} kg${(item.payload as Point).pr ? " 🏆 recorde" : ""}`, "Maior carga"]}
          />
          <Line
            type="monotone"
            dataKey="maxLoad"
            stroke={color}
            strokeWidth={2}
            isAnimationActive={false}
            activeDot={{ r: 6, stroke: surface, strokeWidth: 2 }}
            dot={(props: { cx?: number; cy?: number; index?: number; payload?: unknown }) => {
              const pr = (props.payload as Point | undefined)?.pr;
              return (
                <circle
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={pr ? 6 : 4}
                  fill={pr ? PR : color}
                  stroke={surface}
                  strokeWidth={2}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
