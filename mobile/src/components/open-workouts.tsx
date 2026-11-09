import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { CloudUpload, History, Trash2 } from "lucide-react-native";
import { draftStore } from "~/lib/drafts";
import { flushQueue, pendingActions } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { queryClient } from "~/lib/query";
import { Button, Text, useTheme } from "~/ui";

type StoredDraft = { v: 1; startedAt: string; title?: string; href?: string; exercises: { sets: { done: boolean | null }[] }[] };
type Open = { key: string; title: string; href: string; startedAt: string; done: number };

const when = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? `hoje às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
};

/** "Você tem um treino em aberto": retomar de onde parou ou descartar. */
export function OpenWorkouts({ prefixes }: { prefixes: string[] }) {
  const [open, setOpen] = useState<Open[]>([]);
  const t = useTheme();
  const key = prefixes.join("|");
  useFocusEffect(
    useCallback(() => {
      void draftStore.list(key.split("|")).then((entries) => {
        const found: Open[] = [];
        for (const [k, raw] of entries) {
          const d = raw as StoredDraft;
          if (d?.v !== 1 || !d.href || !d.title) continue;
          const done = d.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.done === true).length, 0);
          if (done > 0) found.push({ key: k, title: d.title, href: d.href, startedAt: d.startedAt, done });
        }
        setOpen(found.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
      });
    }, [key]),
  );
  if (!open.length) return null;
  return (
    <View className="mb-4 gap-2">
      {open.map((o) => (
        <View key={o.key} className="rounded-3xl border-2 border-ipe-500 bg-ipe-100 p-4 dark:bg-ipe-500/10">
          <View className="flex-row items-center gap-2">
            <History color={t.foreground} size={20} />
            <Text className="flex-1 font-display font-bold">Treino em aberto: {o.title}</Text>
          </View>
          <Text className="mt-0.5 text-sm text-muted">
            Começou {when(o.startedAt)} · {o.done} {o.done === 1 ? "série feita" : "séries feitas"}. Retome para finalizar e salvar.
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Button onPress={() => router.push(o.href as never)}>Retomar</Button>
            <Button
              variant="ghost"
              icon={Trash2}
              onPress={async () => {
                if (!(await confirmAsk(`Descartar o treino ${o.title}? As séries marcadas serão perdidas.`, { ok: "Descartar", destructive: true }))) return;
                draftStore.remove(o.key);
                setOpen((l) => l.filter((x) => x.key !== o.key));
              }}
            >
              Descartar
            </Button>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Ações feitas sem internet (treinos, água…) esperando para subir. */
export function PendingSync() {
  const [count, setCount] = useState(0);
  const t = useTheme();
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const tick = async () => {
        if ((await pendingActions()).length) {
          const sent = await flushQueue();
          if (sent) void queryClient.invalidateQueries();
        }
        if (alive) setCount((await pendingActions()).length);
      };
      void tick();
      const id = setInterval(tick, 30_000);
      return () => {
        alive = false;
        clearInterval(id);
      };
    }, []),
  );
  if (!count) return null;
  return (
    <Pressable onPress={() => void flushQueue().then(async () => setCount((await pendingActions()).length))} className="mb-4 flex-row items-center gap-2 rounded-2xl bg-ipe-100 px-4 py-3 dark:bg-ipe-500/15">
      <CloudUpload color={t.dark ? t.ipe400 : t.anil900} size={16} />
      <Text className="flex-1 text-sm text-anil-900 dark:text-ipe-400">
        {count === 1 ? "1 registro salvo no aparelho" : `${count} registros salvos no aparelho`}, aguardando internet para sincronizar.
      </Text>
    </Pressable>
  );
}
