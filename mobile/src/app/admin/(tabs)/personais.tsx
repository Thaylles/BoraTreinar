import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { ChevronRight, Lock, Search } from "lucide-react-native";
import { formatDate } from "@/lib/format";
import { adminData } from "~/lib/admin-data";
import { useData, useRefresh } from "~/lib/data";
import { Alert, EmptyState, Input, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { Avatar } from "~/ui/extras";
import { Chip } from "~/components/exercise-picker";

export default function AdminPersonais() {
  const t = useTheme();
  const sp = useLocalSearchParams<{ filtro?: string; excluido?: string }>();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState(sp.filtro ?? "");
  const data = useData(["admin-personals", search, filtro], () => adminData("adminPersonalsData", search, filtro), { placeholderData: (p) => p });
  const refresh = useRefresh(data);
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Todos os Personais cadastrados.">Personais</PageTitle>
      {sp.excluido ? <Alert kind="success" className="mb-4">Personal excluído. Os alunos dele foram avisados.</Alert> : null}
      <View className="mb-4 justify-center">
        <Input value={q} onChangeText={setQ} onSubmitEditing={() => setSearch(q)} onBlur={() => setSearch(q)} returnKeyType="search" placeholder="Buscar por nome ou e-mail" className="pl-10" />
        <View pointerEvents="none" style={{ position: "absolute", left: 14 }}>
          <Search color={t.muted} size={16} />
        </View>
      </View>
      <View className="mb-4 flex-row gap-2">
        <Chip active={!filtro} onPress={() => setFiltro("")}>Todos</Chip>
        <Chip active={filtro === "bloqueados"} onPress={() => setFiltro("bloqueados")}>Bloqueados no catálogo</Chip>
      </View>
      {!data.data ? (
        <Loading />
      ) : !data.data.personals.length ? (
        <EmptyState icon={Search} title="Nenhum Personal encontrado" />
      ) : (
        <View className="gap-2">
          {data.data.personals.map((p) => (
            <Link key={p.id} href={`/admin/personais/${p.id}`} asChild>
              <Pressable className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <Avatar path={p.avatar_path} name={p.full_name} size={40} />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1">
                    <Text className="font-semibold" numberOfLines={1}>{p.full_name}</Text>
                    {p.catalog_blocked ? <Lock color={t.pitanga600} size={14} /> : null}
                  </View>
                  <Text className="text-xs text-muted" numberOfLines={1}>
                    {p.email} · desde {formatDate(p.created_at)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-display text-lg font-bold">{data.data!.studentsOf[p.id] ?? 0}</Text>
                  <Text className="text-xs text-muted">alunos</Text>
                </View>
                <ChevronRight color={t.muted} size={16} />
              </Pressable>
            </Link>
          ))}
        </View>
      )}
    </Screen>
  );
}
