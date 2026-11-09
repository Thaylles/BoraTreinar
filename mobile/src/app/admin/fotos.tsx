import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Image } from "expo-image";
import { Check, ImageOff, RefreshCw, Sparkles } from "lucide-react-native";
import { equipmentImageSrc, groupLabel } from "@/lib/catalog";
import { callAction } from "~/lib/api";
import { adminData } from "~/lib/admin-data";
import { confirmAsk } from "~/lib/confirm";
import { useData, useRefresh } from "~/lib/data";
import { dataUrlToCatalogJpeg } from "~/lib/upload";
import { Badge, Button, Input, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { Segmented } from "~/ui/forms";

type Draft = { pending?: boolean; image?: string; error?: string; saved?: boolean };

export default function FotosIA() {
  const t = useTheme();
  const [todos, setTodos] = useState(false);
  const q = useData(["admin-photos"], () => adminData("adminPhotosData"));
  const refresh = useRefresh(q);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [hints, setHints] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState(false);
  if (!q.data) return <Loading />;
  const all = q.data;
  const pending = all.filter((e) => e.status !== "ok");
  const list = (todos ? all : pending).map((e) => ({ id: e.id, name: e.name, group: groupLabel(e.muscle_group), owner: e.is_default ? null : (e.owner?.full_name ?? "Personal"), src: equipmentImageSrc(e), status: e.status }));
  const set = (id: string, d: Draft) => setDrafts((a) => ({ ...a, [id]: d }));
  async function generate(id: string) {
    set(id, { pending: true });
    try {
      const r = await callAction<{ error?: string; image?: string }>("admin/fotos#generatePhoto", id, hints[id] ?? "");
      const res = r.result ?? { error: r.error };
      set(id, res.image ? { image: res.image } : { error: res.error ?? "Erro ao gerar." });
      return !res.error;
    } catch {
      set(id, { error: "Não deu para falar com o servidor. Confira a internet e tente de novo." });
      return false;
    }
  }
  async function approve(id: string) {
    const d = drafts[id];
    if (!d?.image) return;
    set(id, { ...d, pending: true });
    try {
      const r = await callAction<{ error?: string } | null>("admin/fotos#savePhoto", id, await dataUrlToCatalogJpeg(d.image));
      const err = r.result?.error ?? r.error;
      set(id, err ? { ...d, pending: false, error: err } : { saved: true });
    } catch {
      set(id, { ...d, pending: false, error: "Não foi possível preparar a imagem." });
    }
  }
  const todo = list.filter((it) => !drafts[it.id]?.image && !drafts[it.id]?.saved);
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Crie com IA a foto dos exercícios sem imagem ou fora do padrão, no mesmo estilo do catálogo. Nada muda até você aprovar.">Fotos com IA</PageTitle>
      <View className="mb-4">
        <Segmented options={[{ value: "0", label: `Precisam (${pending.length})` }, { value: "1", label: `Todos (${all.length})` }]} value={todos ? "1" : "0"} onChange={(v) => setTodos(v === "1")} />
      </View>
      {todo.length > 1 ? (
        <Button
          variant="secondary"
          icon={Sparkles}
          className="mb-4"
          loading={batch}
          onPress={async () => {
            if (!(await confirmAsk(`Gerar fotos com IA para ${todo.length} exercícios? Cada imagem é cobrada na conta do Google (Gemini).`))) return;
            setBatch(true);
            for (const it of todo) if (!(await generate(it.id))) break;
            setBatch(false);
          }}
        >
          {batch ? "Gerando, uma por vez…" : `Gerar com IA as ${todo.length} que faltam`}
        </Button>
      ) : null}
      {!list.length ? <Text className="text-sm text-muted">Todos os exercícios já têm foto no padrão do catálogo. 🎉</Text> : null}
      <View className="gap-4">
        {list.map((it) => {
          const d = drafts[it.id] ?? {};
          return (
            <View key={it.id} className="rounded-3xl border border-border bg-surface p-3">
              <View className="mb-2 flex-row items-start justify-between gap-2">
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold" numberOfLines={1}>{it.name}</Text>
                  <Text className="text-xs text-muted">
                    {it.group}
                    {it.owner ? ` · exercício de ${it.owner}` : ""}
                  </Text>
                </View>
                {d.saved ? <Badge tone="green">Aprovada ✅</Badge> : it.status === "sem" ? <Badge tone="red">Sem foto</Badge> : it.status === "fora" ? <Badge tone="yellow">Fora do padrão</Badge> : null}
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="mb-1 text-[11px] font-semibold text-muted">Atual</Text>
                  {it.src ? (
                    <Image source={it.src} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: "#fff" }} contentFit="contain" />
                  ) : (
                    <View className="aspect-[4/3] items-center justify-center rounded-xl bg-border/40">
                      <ImageOff color={t.muted} size={24} />
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-[11px] font-semibold text-muted">Gerada com IA</Text>
                  <View className="aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-white">
                    {d.image ? <Image source={d.image} style={{ width: "100%", height: "100%" }} contentFit="contain" /> : d.pending ? <ActivityIndicator /> : <Sparkles color={t.muted} size={24} />}
                  </View>
                </View>
              </View>
              {!d.saved ? (
                <View className="mt-3 gap-2">
                  <Input value={hints[it.id] ?? ""} onChangeText={(v) => setHints((h) => ({ ...h, [it.id]: v }))} maxLength={300} placeholder="Como é o exercício? (opcional, ajuda a IA)" />
                  {d.error ? <Text className="text-sm text-pitanga-600">{d.error}</Text> : null}
                  <View className="flex-row gap-2">
                    {d.image ? (
                      <Button size="sm" icon={Check} className="flex-1" disabled={d.pending} onPress={() => approve(it.id)}>
                        Aprovar
                      </Button>
                    ) : null}
                    <Button size="sm" variant={d.image ? "ghost" : "secondary"} icon={d.image ? RefreshCw : Sparkles} className="flex-1" loading={d.pending && !d.image} disabled={d.pending || batch} onPress={() => generate(it.id)}>
                      {d.image ? "Gerar outra" : "Gerar com IA"}
                    </Button>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <Text className="mt-6 text-xs text-muted">A IA usa fotos do catálogo como referência de estilo. Cada imagem gerada é cobrada na conta do Google (Gemini) configurada na Vercel. Inclui os exercícios criados pelos Personais.</Text>
    </Screen>
  );
}
