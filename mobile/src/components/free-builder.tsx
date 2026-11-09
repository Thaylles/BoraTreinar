import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Link, router } from "expo-router";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowDown, ArrowUp, Play, Plus, Save, Trash2 } from "lucide-react-native";
import { equipmentImageSrc, groupLabel } from "@/lib/catalog";
import { callAction } from "~/lib/api";
import { Alert, Button, Input, Text, useTheme } from "~/ui";
import { Disclosure } from "~/ui/extras";
import { ExercisePicker, type CatalogItem } from "./exercise-picker";

const KEY = "bt:livre:ultimo";

/** Monta o treino livre do dia escolhendo exercícios do catálogo. */
export function FreeBuilder({ catalog, max, canSave = false, extraQuery = "", base = "/aluno/livre/treinar" }: { catalog: CatalogItem[]; max: number; canSave?: boolean; extraQuery?: string; base?: string }) {
  const t = useTheme();
  const [ids, setIds] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const items = ids.map((id) => byId.get(id)).filter((c): c is CatalogItem => !!c);

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((raw) => {
      const last = raw ? (JSON.parse(raw) as string[]) : [];
      if (last.length) setIds(last.filter((id) => catalog.some((c) => c.id === id)));
    });
  }, [catalog]);

  const move = (i: number, d: number) =>
    setIds((l) => {
      const n = [...l];
      const [x] = n.splice(i, 1);
      n.splice(i + d, 0, x);
      return n;
    });
  const toggle = (c: CatalogItem) => setIds((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : l.length >= max ? l : [...l, c.id]));
  function start() {
    void AsyncStorage.setItem(KEY, JSON.stringify(ids));
    router.push(`${base}?e=${ids.join(",")}${extraQuery ? `&${extraQuery}` : ""}` as never);
  }

  return (
    <View className="gap-4">
      {!items.length ? (
        <View className="rounded-3xl border-2 border-dashed border-border p-6">
          <Text className="text-center text-sm text-muted">Escolha os exercícios que você vai fazer hoje. Só dá para usar exercícios do catálogo.</Text>
        </View>
      ) : (
        <View className="gap-2">
          {items.map((c, i) => {
            const src = equipmentImageSrc(c);
            return (
              <View key={c.id} className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-2">
                <Text className="w-5 text-center font-display font-bold text-bandeira-600 dark:text-bandeira-100">{i + 1}</Text>
                {src ? <Image source={src} style={{ width: 48, height: 48, borderRadius: 12 }} contentFit="cover" /> : null}
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold" numberOfLines={1}>{c.name}</Text>
                  <Text className="text-xs text-muted">{groupLabel(c.muscle_group)}</Text>
                </View>
                <Pressable accessibilityLabel="Subir" disabled={i === 0} onPress={() => move(i, -1)} className={i === 0 ? "p-2 opacity-30" : "p-2"}>
                  <ArrowUp color={t.muted} size={16} />
                </Pressable>
                <Pressable accessibilityLabel="Descer" disabled={i === items.length - 1} onPress={() => move(i, 1)} className={i === items.length - 1 ? "p-2 opacity-30" : "p-2"}>
                  <ArrowDown color={t.muted} size={16} />
                </Pressable>
                <Pressable accessibilityLabel="Remover" onPress={() => setIds((l) => l.filter((x) => x !== c.id))} className="p-2">
                  <Trash2 color={t.pitanga600} size={16} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
      <Pressable
        onPress={() => setPicking(true)}
        disabled={ids.length >= max}
        className={`flex-row items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-bandeira-500/50 py-4 ${ids.length >= max ? "opacity-40" : ""}`}
      >
        <Plus color={t.dark ? t.bandeira100 : t.bandeira600} size={20} />
        <Text className="font-display font-bold text-bandeira-600 dark:text-bandeira-100">{ids.length ? "Adicionar mais exercícios" : "Escolher exercícios"}</Text>
      </Pressable>
      {ids.length >= max ? <Text className="text-center text-xs text-muted">Máximo de {max} exercícios por treino.</Text> : null}
      {canSave && ids.length ? <SaveAsPlan ids={ids} /> : null}
      <Button size="lg" icon={Play} disabled={!ids.length} onPress={start}>
        Começar treino livre
      </Button>
      {picking ? <ExercisePicker catalog={catalog} selectedIds={ids} onPick={toggle} onClose={() => setPicking(false)} allowRequest={canSave} /> : null}
    </View>
  );
}

function SaveAsPlan({ ids }: { ids: string[] }) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (saved)
    return (
      <Alert kind="success">
        <Text className="text-sm text-bandeira-700 dark:text-bandeira-100">Ficha salva! Ela aparece em &quot;Suas fichas&quot; na tela inicial.</Text>
        <Link href={`/aluno/fichas/${saved}`}>
          <Text className="text-sm font-semibold underline">Ver ficha</Text>
        </Link>
      </Alert>
    );
  return (
    <View className="rounded-3xl border border-border bg-surface p-4">
      <Disclosure label="💾 Salvar como ficha (opcional)">
        <Text className="mt-2 text-sm text-muted">Vai repetir este treino outras vezes? Salve como ficha. Se for só hoje, não precisa.</Text>
        <View className="mt-3 flex-row gap-2">
          <View className="flex-1">
            <Input value={name} onChangeText={setName} maxLength={60} placeholder="Nome da ficha (ex.: Treino A)" accessibilityLabel="Nome da ficha" />
          </View>
          <Button
            icon={Save}
            className="bg-anil-700"
            loading={pending}
            disabled={!name.trim()}
            onPress={async () => {
              setPending(true);
              setError(null);
              try {
                const r = await callAction<{ id?: string; error?: string }>("aluno/fichas#saveFreeAsPlan", name, ids);
                if (r.result?.error || r.error) setError(r.result?.error ?? r.error ?? null);
                else if (r.result?.id) setSaved(r.result.id);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            Salvar
          </Button>
        </View>
        {error ? <Alert className="mt-2">{error}</Alert> : null}
      </Disclosure>
    </View>
  );
}
