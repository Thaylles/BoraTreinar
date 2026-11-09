import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { Text, useTheme } from "~/ui";

export type TrendPoint = { date: string; value: number; highlight?: boolean };
type Week = { week: string; sessions: number; volume: number };

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const shortDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) ? ddmm(d) : new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const SERIES = { light: "#009C3B", dark: "#1DA857" };
const PR = "#E6A800";

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))] as const;
}

/** Treinos por semana (seg–dom); a semana do período fica destacada. Toque numa barra para ver os números. */
export function WeeklyBars({ weeks, current }: { weeks: Week[]; current: string }) {
  const t = useTheme();
  const [w, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const H = 150;
  const top = 10;
  const bottom = 22;
  const left = 22;
  const max = Math.max(1, ...weeks.map((x) => x.sessions));
  const base = t.dark ? SERIES.dark : SERIES.light;
  const slot = weeks.length ? (w - left) / weeks.length : 0;
  const barW = Math.min(28, slot * 0.6);
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  const ticks = [...new Set([0, Math.round(max / 2), max])];
  const total = weeks.reduce((a, x) => a + x.sessions, 0);
  const picked = sel != null ? weeks[sel] : null;
  return (
    <View onLayout={onLayout} accessibilityRole="image" accessibilityLabel={`Treinos por semana nas últimas ${weeks.length} semanas: ${weeks.map((x) => `${ddmm(x.week)}: ${x.sessions}`).join(", ")}. Total ${total}.`}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          {ticks.map((v) => (
            <Line key={v} x1={left} x2={w} y1={y(v)} y2={y(v)} stroke={t.muted} strokeOpacity={0.15} />
          ))}
          {ticks.map((v) => (
            <SvgText key={`l${v}`} x={left - 6} y={y(v) + 4} fontSize={10} fill={t.muted} textAnchor="end">
              {v}
            </SvgText>
          ))}
          {weeks.map((x, i) => {
            const cx = left + slot * i + slot / 2;
            const h = H - bottom - y(x.sessions);
            return (
              <Rect
                key={x.week}
                x={cx - barW / 2}
                y={y(x.sessions)}
                width={barW}
                height={Math.max(0, h)}
                rx={5}
                fill={x.week === current || sel === i ? base : `${base}55`}
                onPress={() => setSel(sel === i ? null : i)}
              />
            );
          })}
          {weeks.map((x, i) => (
            <SvgText key={`x${x.week}`} x={left + slot * i + slot / 2} y={H - 6} fontSize={9} fill={t.muted} textAnchor="middle">
              {ddmm(x.week)}
            </SvgText>
          ))}
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}
      <Text className="text-center text-xs text-muted">
        {picked
          ? `Semana de ${ddmm(picked.week)}: ${picked.sessions} ${picked.sessions === 1 ? "treino" : "treinos"} · ${picked.volume.toLocaleString("pt-BR")} kg`
          : "Toque numa barra para ver a semana."}
      </Text>
    </View>
  );
}

/** Linha de evolução (uma série); pontos com destaque (recordes) em amarelo. Toque para ver o valor. */
export function TrendChart({
  points,
  label,
  unit = "kg",
  highlightLabel = "recorde",
  emptyText = "Registre pelo menos dois valores para ver o gráfico.",
}: {
  points: TrendPoint[];
  label: string;
  unit?: string;
  highlightLabel?: string;
  emptyText?: string;
}) {
  const t = useTheme();
  const [w, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  if (points.length < 2) return <Text className="py-6 text-center text-sm text-muted">{emptyText}</Text>;
  const H = 200;
  const pad = { top: 12, right: 12, bottom: 22, left: 44 };
  const vals = points.map((p) => p.value);
  const lo = Math.floor(Math.min(...vals) - 2);
  const hi = Math.ceil(Math.max(...vals) + 2);
  const color = t.dark ? SERIES.dark : SERIES.light;
  const x = (i: number) => pad.left + ((w - pad.left - pad.right) * i) / (points.length - 1);
  const y = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - (v - lo) / Math.max(1, hi - lo));
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const labelIdx = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const picked = sel != null ? points[sel] : points[points.length - 1];
  return (
    <View onLayout={onLayout} accessibilityRole="image" accessibilityLabel={`Gráfico: ${label}`}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          {ticks.map((v) => (
            <Line key={v} x1={pad.left} x2={w - pad.right} y1={y(v)} y2={y(v)} stroke={t.muted} strokeOpacity={0.15} />
          ))}
          {ticks.map((v) => (
            <SvgText key={`t${v}`} x={pad.left - 6} y={y(v) + 4} fontSize={10} fill={t.muted} textAnchor="end">
              {`${v}${unit}`}
            </SvgText>
          ))}
          <Path d={d} stroke={color} strokeWidth={2} fill="none" />
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={x(i)}
              cy={y(p.value)}
              r={sel === i ? 7 : p.highlight ? 6 : 4}
              fill={p.highlight ? PR : color}
              stroke={t.surface}
              strokeWidth={2}
              onPress={() => setSel(i)}
            />
          ))}
          {labelIdx.map((i) => (
            <SvgText key={`d${i}`} x={x(i)} y={H - 6} fontSize={10} fill={t.muted} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
              {shortDate(points[i].date)}
            </SvgText>
          ))}
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}
      <Text className="text-center text-xs text-muted">
        {shortDate(picked.date)}: {picked.value.toLocaleString("pt-BR")} {unit}
        {picked.highlight ? ` 🏆 ${highlightLabel}` : ""}
      </Text>
    </View>
  );
}
