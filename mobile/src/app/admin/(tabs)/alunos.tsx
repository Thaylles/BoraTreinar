import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { ChevronRight, Search } from "lucide-react-native";
import { adminData } from "~/lib/admin-data";
import { useData, useRefresh } from "~/lib/data";
import { EmptyState, Input, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";

export default function AdminAlunos() {
  const t = useTheme();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const data = useData(["admin-students", search], () => adminData("adminStudentsData", search), { placeholderData: (p) => p });
  const refresh = useRefresh(data);
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Todos os alunos e seus Personais.">Alunos</PageTitle>
      <View className="mb-4 justify-center">
        <Input value={q} onChangeText={setQ} onSubmitEditing={() => setSearch(q)} onBlur={() => setSearch(q)} returnKeyType="search" placeholder="Buscar por nome ou e-mail" className="pl-10" />
        <View pointerEvents="none" style={{ position: "absolute", left: 14 }}>
          <Search color={t.muted} size={16} />
        </View>
      </View>
      {!data.data ? (
        <Loading />
      ) : !data.data.students.length ? (
        <EmptyState icon={Search} title="Nenhum aluno encontrado" />
      ) : (
        <View className="gap-2">
          {data.data.students.map((s) => (
            <Link key={s.id} href={`/admin/alunos/${s.id}`} asChild>
              <Pressable className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold" numberOfLines={1}>{s.full_name}</Text>
                  <Text className="text-xs text-muted" numberOfLines={1}>{s.email}</Text>
                </View>
                <Text className="max-w-[45%] text-right text-xs text-muted" numberOfLines={2}>
                  {data.data!.personalsOf[s.id]?.join(", ") || "sem Personal ativo"}
                </Text>
                <ChevronRight color={t.muted} size={16} />
              </Pressable>
            </Link>
          ))}
        </View>
      )}
    </Screen>
  );
}
