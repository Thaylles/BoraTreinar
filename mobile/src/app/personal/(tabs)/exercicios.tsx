import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { Link } from "expo-router";
import { Plus, Search, SearchX } from "lucide-react-native";
import { groupLabel, MUSCLE_GROUPS, type MuscleGroup } from "@/lib/catalog";
import { loadOpenRequests } from "@/lib/exercise-requests-server";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Badge, EmptyState, Input, LinkButton, Loading, PageTitle, Text, useTheme } from "~/ui";
import { ShortcutCard } from "~/ui/extras";
import { Chip } from "~/components/exercise-picker";
import { EquipmentImage } from "~/components/plan-view";

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function Exercicios() {
  const profile = useProfile();
  const t = useTheme();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [mine, setMine] = useState(false);
  const data = useData(["equipment-list"], async () => {
    const [{ data: items }, open] = await Promise.all([supabase.from("equipment").select("id, name, muscle_group, image_path, image_url, is_default, created_by, is_bodyweight").order("name"), loadOpenRequests()]);
    return { items: items ?? [], open };
  });
  const refresh = useRefresh(data);
  const items = useMemo(() => {
    const nq = normalize(q.trim());
    return (data.data?.items ?? []).filter((e) => (!nq || normalize(e.name).includes(nq)) && (!group || e.muscle_group === group) && (!mine || e.created_by === profile.id));
  }, [data.data, q, group, mine, profile.id]);
  if (!data.data) return <Loading />;
  const open = data.data.open;
  const header = (
    <View className="px-4 pt-4">
      <View className="flex-row items-start justify-between gap-3">
        <PageTitle sub={`${items.length} no catálogo`}>Exercícios</PageTitle>
        {!profile.catalog_blocked ? (
          <LinkButton href="/personal/exercicios/novo" size="sm" icon={Plus} className="mt-1">
            Novo
          </LinkButton>
        ) : null}
      </View>
      {open.length ? (
        <ShortcutCard
          href="/personal/exercicios/pedidos"
          emoji="💡"
          title={open.length === 1 ? "1 exercício pedido pelos alunos" : `${open.length} exercícios pedidos pelos alunos`}
          sub={`${open.slice(0, 3).map((r) => r.name).join(", ")}${open.length > 3 ? "…" : ""} · Adicione ao catálogo para todos usarem.`}
          className="border-2 border-ipe-500"
        />
      ) : null}
      {profile.catalog_blocked ? (
        <View className="mb-3 rounded-2xl bg-border/40 px-3 py-2">
          <Text className="text-sm text-muted">🔒 Sua conta está sem permissão para criar ou editar exercícios. Você continua usando o catálogo nas fichas.</Text>
        </View>
      ) : null}
      <View className="mb-3 justify-center">
        <Input value={q} onChangeText={setQ} placeholder="Buscar exercício…" className="pl-12" />
        <View pointerEvents="none" style={{ position: "absolute", left: 16 }}>
          <Search color={t.muted} size={20} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 mb-4" contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <Chip active={!group && !mine} onPress={() => { setGroup(null); setMine(false); }}>Todos</Chip>
        <Chip active={mine} onPress={() => setMine(!mine)}>Criados por mim</Chip>
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g.value} active={group === g.value} onPress={() => setGroup(group === g.value ? null : g.value)}>
            {g.label}
          </Chip>
        ))}
      </ScrollView>
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
      ListEmptyComponent={<View className="px-4"><EmptyState icon={SearchX} title="Nada encontrado">Não achou? Cadastre um exercício novo.</EmptyState></View>}
      columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
      contentContainerStyle={{ gap: 12, paddingBottom: 96 }}
      initialNumToRender={12}
      renderItem={({ item: e }) => (
        <Link href={`/personal/exercicios/${e.id}`} asChild>
          <Pressable className="flex-1 rounded-3xl border border-border bg-surface p-2">
            <EquipmentImage equipment={e} />
            <View className="px-1 pb-1 pt-2">
              <Text className="text-sm font-semibold leading-tight" numberOfLines={2}>{e.name}</Text>
              <View className="mt-1 flex-row flex-wrap items-center gap-1">
                <Text className="text-xs text-muted">{groupLabel(e.muscle_group)}</Text>
                {e.created_by === profile.id ? <Badge tone="green">Meu</Badge> : null}
                {!e.is_default && e.created_by !== profile.id ? <Badge tone="blue">Outro Personal</Badge> : null}
              </View>
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}
