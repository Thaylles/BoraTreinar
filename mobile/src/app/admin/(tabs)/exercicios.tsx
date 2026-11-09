import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Lock, LockOpen, Pencil, Search } from "lucide-react-native";
import { groupLabel } from "@/lib/catalog";
import { form } from "~/lib/api";
import { adminData } from "~/lib/admin-data";
import { useData, useRefresh } from "~/lib/data";
import { useCall } from "~/lib/use-action";
import { Alert, EmptyState, Input, Loading, PageTitle, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Chip } from "~/components/exercise-picker";
import { EquipmentImage } from "~/components/plan-view";

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "padrao", label: "Catálogo padrão" },
  { key: "proprios", label: "De Personais" },
  { key: "travados", label: "Travados" },
] as const;

export default function AdminExercicios() {
  const t = useTheme();
  const sp = useLocalSearchParams<{ filtro?: string; excluido?: string }>();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState(sp.filtro ?? "");
  const data = useData(["admin-equipment", search, filtro], () => adminData("adminEquipmentList", search, filtro), { placeholderData: (p) => p });
  const refresh = useRefresh(data);
  const lock = useCall("admin#adminSetEquipmentLocked");
  if (!data.data) return <Loading />;
  const items = data.data;
  const header = (
    <View className="px-4 pt-4">
      <PageTitle sub="Toque num exercício para editar nome, foto e descrição. Travado, nenhum Personal edita, exclui ou troca a foto.">Exercícios e máquinas</PageTitle>
      {sp.excluido ? <Alert kind="success" className="mb-3">{`Exercício “${sp.excluido}” excluído.`}</Alert> : null}
      <View className="mb-3 justify-center">
        <Input value={q} onChangeText={setQ} onSubmitEditing={() => setSearch(q)} onBlur={() => setSearch(q)} returnKeyType="search" placeholder="Buscar exercício" className="pl-10" />
        <View pointerEvents="none" style={{ position: "absolute", left: 14 }}>
          <Search color={t.muted} size={16} />
        </View>
      </View>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filtro === f.key} onPress={() => setFiltro(f.key)}>
            {f.label}
          </Chip>
        ))}
      </View>
      <Text className="mb-3 text-xs text-muted">
        {items.length} {items.length === 1 ? "exercício" : "exercícios"} · {items.filter((e) => e.locked).length} travados
      </Text>
    </View>
  );
  return (
    <FlatList
      className="flex-1 bg-background"
      data={items}
      keyExtractor={(e) => e.id}
      numColumns={2}
      refreshControl={refresh}
      ListHeaderComponent={header}
      ListEmptyComponent={<View className="px-4"><EmptyState icon={Search} title="Nenhum exercício encontrado" /></View>}
      columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
      contentContainerStyle={{ gap: 12, paddingBottom: 96 }}
      initialNumToRender={10}
      renderItem={({ item: e }) => (
        <View className={cn("flex-1 overflow-hidden rounded-2xl border bg-surface", e.locked ? "border-pitanga-500/50" : "border-border")}>
          <Link href={`/admin/exercicios/${e.id}`} asChild>
            <Pressable>
              <EquipmentImage equipment={e} />
            </Pressable>
          </Link>
          <View className="flex-1 gap-2 p-3">
            <View className="flex-1">
              <View className="flex-row items-start gap-1">
                {e.locked ? <Lock color={t.pitanga600} size={14} style={{ marginTop: 2 }} /> : null}
                <Text className="flex-1 text-sm font-semibold leading-snug">{e.name}</Text>
              </View>
              <Text className="mt-0.5 text-xs text-muted">
                {groupLabel(e.muscle_group)} · {e.is_default ? "catálogo padrão" : `de ${e.owner?.full_name ?? "Personal excluído"}`}
                {e.is_default && e.image_credit?.startsWith("Foto enviada") ? ` · ${e.image_credit}` : ""}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Link href={`/admin/exercicios/${e.id}`} asChild>
                <Pressable className="flex-1 flex-row items-center justify-center gap-1 rounded-xl border-2 border-border px-2 py-1.5">
                  <Pencil color={t.foreground} size={14} />
                  <Text className="text-xs font-bold">Editar</Text>
                </Pressable>
              </Link>
              <Pressable
                onPress={() => lock.run(form({ id: e.id, locked: e.locked ? "0" : "1" }))}
                accessibilityLabel={e.locked ? `Destravar ${e.name}` : `Travar ${e.name}`}
                className={cn("flex-1 flex-row items-center justify-center gap-1 rounded-xl border-2 px-2 py-1.5", e.locked ? "border-pitanga-500" : "border-border")}
              >
                {e.locked ? <LockOpen color={t.pitanga600} size={14} /> : <Lock color={t.foreground} size={14} />}
                <Text className={cn("text-xs font-bold", e.locked && "text-pitanga-600")}>{e.locked ? "Destravar" : "Travar"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    />
  );
}
