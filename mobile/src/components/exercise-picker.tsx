import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, MessageSquarePlus, Search, X } from "lucide-react-native";
import { MUSCLE_GROUPS, equipmentImageSrc, groupLabel, type MuscleGroup } from "@/lib/catalog";
import type { CatalogItem } from "@/components/plans/exercise-picker";
import { callAction } from "~/lib/api";
import { Button, FormMessage, inputClass, Input, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";

export type { CatalogItem };
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Tela cheia para escolher exercícios do catálogo (igual ao site). */
export function ExercisePicker({
  catalog,
  selectedIds,
  onPick,
  onRepeat,
  onRemove,
  onClose,
  multiple = true,
  cautions = {},
  allowRequest = false,
}: {
  catalog: CatalogItem[];
  selectedIds: string[];
  onPick: (item: CatalogItem) => void;
  onRepeat?: (item: CatalogItem) => void;
  onRemove?: (item: CatalogItem) => void;
  onClose: () => void;
  multiple?: boolean;
  cautions?: Record<string, string[]>;
  allowRequest?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [ask, setAsk] = useState<CatalogItem | null>(null);
  const groups = useMemo(() => MUSCLE_GROUPS.filter((g) => catalog.some((c) => c.muscle_group === g.value)), [catalog]);
  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return catalog.filter((c) => (!group || c.muscle_group === group) && (!nq || normalize(c.name).includes(nq)));
  }, [catalog, q, group]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="gap-3 border-b border-border p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="font-display text-xl font-bold">Escolher exercício</Text>
              {multiple ? (
                <Text className="text-xs text-muted">
                  {onRepeat ? "Toque para marcar; toque num marcado para repetir ou retirar." : "Toque para marcar; toque de novo para desmarcar."}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Fechar" className="rounded-full p-2">
              <X color={t.foreground} size={20} />
            </Pressable>
          </View>
          <View className="justify-center">
            <Input value={q} onChangeText={setQ} placeholder="Buscar no catálogo…" accessibilityLabel="Buscar no catálogo" className="pl-12" />
            <View pointerEvents="none" style={{ position: "absolute", left: 16 }}>
              <Search color={t.muted} size={20} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" className="-mx-4" contentContainerStyle={{ paddingHorizontal: 16 }}>
            <Chip active={!group} onPress={() => setGroup(null)}>
              Todos
            </Chip>
            {groups.map((g) => (
              <Chip key={g.value} active={group === g.value} onPress={() => setGroup(group === g.value ? null : g.value)}>
                {g.label}
              </Chip>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 8 }}
          initialNumToRender={20}
          ListEmptyComponent={<Text className="p-6 text-center text-sm text-muted">Nada encontrado.</Text>}
          ListFooterComponent={allowRequest ? <View className="p-2"><RequestExercise key={q} initialName={filtered.length ? "" : q.trim()} highlight={!filtered.length} /></View> : undefined}
          renderItem={({ item: c }) => {
            const src = equipmentImageSrc(c);
            const count = selectedIds.filter((id) => id === c.id).length;
            const selected = count > 0;
            return (
              <Pressable
                onPress={() => {
                  if (selected && onRepeat && onRemove) return setAsk(c);
                  onPick(c);
                  if (!multiple) onClose();
                }}
                accessibilityState={multiple ? { selected } : undefined}
                className={cn("flex-row items-center gap-3 rounded-2xl p-2", multiple && selected && "bg-bandeira-50 dark:bg-bandeira-500/10")}
              >
                {src ? (
                  <Image source={src} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" recyclingKey={c.id} />
                ) : (
                  <View className="size-14 items-center justify-center rounded-xl bg-anil-700/5">
                    <Text className="text-center text-[10px] font-semibold text-muted">{groupLabel(c.muscle_group)}</Text>
                  </View>
                )}
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold leading-tight">{c.name}</Text>
                  <Text className="text-xs text-muted">{groupLabel(c.muscle_group)}</Text>
                  {cautions[c.muscle_group] ? <Text className="text-xs font-semibold text-pitanga-600">⚠️ {cautions[c.muscle_group].join(", ")}</Text> : null}
                </View>
                {multiple ? (
                  <View className={cn("size-7 items-center justify-center rounded-full border-2", selected ? "border-bandeira-500 bg-bandeira-500" : "border-border")}>
                    {count > 1 ? <Text className="text-xs font-bold text-white">{count}×</Text> : selected ? <Check color="#fff" size={16} /> : null}
                  </View>
                ) : selected ? (
                  <View className="rounded-full bg-bandeira-500 p-1" accessibilityLabel="Já na ficha">
                    <Check color="#fff" size={16} />
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />

        {multiple ? (
          <View className="border-t border-border p-4" style={{ paddingBottom: insets.bottom + 16 }}>
            <Button onPress={onClose}>
              {`Pronto${selectedIds.length ? ` · ${selectedIds.length} ${selectedIds.length === 1 ? "exercício" : "exercícios"}` : ""}`}
            </Button>
          </View>
        ) : null}

        {ask ? (
          <Pressable className="absolute inset-0 justify-end bg-black/40" onPress={() => setAsk(null)}>
            <Pressable accessibilityRole="alert" onPress={() => {}} className="gap-3 rounded-t-3xl bg-background p-5" style={{ paddingBottom: insets.bottom + 20 }}>
              <Text className="font-display text-lg font-bold leading-tight">{ask.name} já está na ficha</Text>
              <Text className="text-sm text-muted">Você deseja fazer esse exercício novamente? Ou gostaria de retirá-lo?</Text>
              <Button
                variant="danger"
                onPress={() => {
                  onRemove?.(ask);
                  setAsk(null);
                }}
              >
                Retirar da ficha
              </Button>
              <Pressable
                onPress={() => {
                  onRepeat?.(ask);
                  setAsk(null);
                }}
                className="items-center rounded-2xl border-2 border-border bg-surface py-3"
              >
                <Text className="font-display font-bold">Fazer novamente (adicionar outra vez)</Text>
              </Pressable>
              <Pressable onPress={() => setAsk(null)} className="items-center py-2">
                <Text className="text-sm font-semibold text-muted">Cancelar</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

export function Chip({ active, onPress, children }: { active: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable onPress={onPress} accessibilityState={{ selected: active }} className={cn("rounded-full px-3 py-1.5", active ? "bg-anil-700 dark:bg-ipe-500" : "border border-border bg-surface")}>
      <Text className={cn("text-sm font-semibold", active ? "text-white dark:text-anil-900" : "text-muted")}>{children}</Text>
    </Pressable>
  );
}

/** "Não encontrou o exercício?": o aluno pede e Personais/admins adicionam ao catálogo. */
function RequestExercise({ initialName, highlight }: { initialName: string; highlight: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(highlight);
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, setPending] = useState(false);
  if (state?.ok) return <FormMessage state={state} />;
  if (!open)
    return (
      <Pressable onPress={() => setOpen(true)} className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-3">
        <MessageSquarePlus color={t.muted} size={16} />
        <Text className="text-sm font-semibold text-muted">Não encontrou o exercício?</Text>
      </Pressable>
    );
  return (
    <View className="gap-2 rounded-2xl border-2 border-ipe-500 bg-ipe-100/50 p-3 dark:bg-ipe-500/10">
      <Text className="font-display text-base font-bold">Não encontrou o exercício?</Text>
      <Text className="text-sm text-muted">Escreva o nome do exercício ou da máquina para que os administradores possam adicionar ao catálogo.</Text>
      <TextInput value={name} onChangeText={setName} maxLength={80} placeholder="Ex.: Remada cavalinho na máquina" placeholderTextColor={t.muted} className={cn(inputClass, "py-2")} style={{ fontFamily: "Inter_400Regular" }} />
      <TextInput value={note} onChangeText={setNote} maxLength={300} placeholder="Detalhe opcional (como é a máquina, para que serve…)" placeholderTextColor={t.muted} className={cn(inputClass, "py-2 text-sm")} style={{ fontFamily: "Inter_400Regular" }} />
      <FormMessage state={state} />
      <Button
        disabled={name.trim().length < 2}
        loading={pending}
        className="bg-anil-700"
        onPress={async () => {
          setPending(true);
          try {
            const r = await callAction<{ error?: string; ok?: string }>("aluno/fichas#requestExercise", name, note);
            setState(r.result ?? { error: r.error });
          } catch (e) {
            setState({ error: (e as Error).message });
          } finally {
            setPending(false);
          }
        }}
      >
        Enviar pedido
      </Button>
    </View>
  );
}
