import type React from "react";
import { useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { MessageCircle, Share2 } from "lucide-react-native";
import type { MonthSummary } from "@/lib/month-summary";
import { Button, Text } from "~/ui";
import { Gradient } from "~/ui/extras";

const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`);
const kg = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} kg`;

/** Cartão 4:5 (vira imagem 1080×1350 para Instagram/WhatsApp). */
function ShareCard({ s, names }: { s: MonthSummary; names: Record<string, string> }) {
  const daysInMonth = new Date(Number(s.month.slice(0, 4)), Number(s.month.slice(5, 7)), 0).getDate();
  const active = new Set(s.activeDays.map((d) => Number(d.slice(8))));
  const stats = [
    [String(s.activeDays.length), "dias treinados"],
    [s.perWeek.toLocaleString("pt-BR"), "por semana"],
    [hours(s.minutes), "treinando"],
    [kg(s.volume), "levantados"],
  ];
  return (
    <View style={{ width: 360, height: 450, backgroundColor: "#004d1e" }}>
      <Gradient className="flex-1 rounded-none">
        <View style={{ height: 5, backgroundColor: "#ffc72c" }} />
        <View style={{ height: 2, backgroundColor: "#1a3f99" }} />
        <View className="flex-1 px-7 pt-5">
          <Text className="font-display text-base font-extrabold text-white">BoraTreinar</Text>
          <Text className="text-sm font-semibold text-white/80">{s.label}</Text>
          <View className="mt-2 flex-row items-end gap-2">
            <Text className="font-display font-extrabold text-white" style={{ fontSize: 72, lineHeight: 80 }}>
              {s.sessions}
            </Text>
            <Text className="mb-3 font-display text-2xl font-extrabold text-white">{s.sessions === 1 ? "treino" : "treinos"}</Text>
          </View>
          <View className="flex-row flex-wrap justify-between gap-y-2">
            {stats.map(([v, l]) => (
              <View key={l} className="rounded-xl bg-white/15 px-3 py-2" style={{ width: "48.5%" }}>
                <Text className="text-[10px] font-semibold text-white/80">{l}</Text>
                <Text className="font-display text-xl font-extrabold text-white" numberOfLines={1}>
                  {v}
                </Text>
              </View>
            ))}
          </View>
          {s.cardio.minutes ? (
            <Text className="mt-3 text-xs font-bold text-white">
              🏃 {s.cardio.minutes} min de cardio{s.cardio.km ? ` · ${s.cardio.km.toLocaleString("pt-BR")} km` : ""}
            </Text>
          ) : null}
          {s.prs.length ? (
            <View className="mt-2">
              <Text className="text-xs font-bold text-ipe-400">
                🏆 {s.prs.length} {s.prs.length === 1 ? "recorde" : "recordes"} no mês
              </Text>
              {s.prs.slice(0, 3).map((p) => (
                <Text key={p.id} className="text-[11px] font-semibold text-white" numberOfLines={1}>
                  {names[p.id] ?? "Exercício"} · {kg(p.load)}
                </Text>
              ))}
            </View>
          ) : null}
          <View className="mt-auto flex-row flex-wrap gap-1.5 pb-2">
            {Array.from({ length: daysInMonth }, (_, i) => (
              <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: active.has(i + 1) ? "#ffc72c" : "rgba(255,255,255,.18)" }} />
            ))}
          </View>
          <Text className="pb-4 text-[10px] font-semibold text-white/75">Bora treinar! 🇧🇷</Text>
        </View>
      </Gradient>
    </View>
  );
}

/** Compartilhar o resumo: imagem (Instagram, WhatsApp…) ou só o texto no WhatsApp. */
export function MonthShare({ summary, names, text }: { summary: MonthSummary; names: Record<string, string>; text: string }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!summary.sessions) return null;
  async function share() {
    setBusy(true);
    setMsg(null);
    try {
      const uri = await captureRef(ref, { format: "png", quality: 1, width: 1080, height: 1350, fileName: `boratreinar-${summary.month}` });
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Compartilhar resumo" });
      else setMsg("Compartilhamento indisponível neste aparelho.");
    } catch {
      setMsg("Não deu para gerar a imagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="gap-2">
      {/* Fora da tela: só para virar imagem. */}
      <View style={{ position: "absolute", left: -10000, top: 0 }} pointerEvents="none">
        <View ref={ref} collapsable={false}>
          <ShareCard s={summary} names={names} />
        </View>
      </View>
      <Button size="lg" icon={Share2} className="bg-anil-700" loading={busy} onPress={share}>
        Compartilhar (Instagram, WhatsApp…)
      </Button>
      <Button icon={MessageCircle} className="bg-[#25D366]" textClassName="text-[#0b3d1f]" onPress={() => void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`)}>
        Texto no WhatsApp
      </Button>
      {msg ? <Text className="text-center text-sm text-muted">{msg}</Text> : null}
    </View>
  );
}
