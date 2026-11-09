import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { ChevronRight, ClipboardList, Plus, Users } from "lucide-react-native";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Alert, Card, EmptyState, LinkButton, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { ShortcutCard } from "~/ui/extras";

export default function Modelos() {
  const profile = useProfile();
  const t = useTheme();
  const { prontos } = useLocalSearchParams<{ prontos?: string }>();
  const q = useData(["templates", profile.id], async () => (await supabase.from("workout_plans").select("id, name, goal, items:workout_plan_items(count)").eq("is_template", true).eq("created_by", profile.id).order("name")).data ?? []);
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <View className="flex-row items-start justify-between gap-3">
        <PageTitle sub="Fichas prontas para aplicar nos seus alunos.">Modelos</PageTitle>
        <LinkButton href="/personal/modelos/novo" size="sm" icon={Plus} className="mt-1">
          Novo
        </LinkButton>
      </View>
      {prontos !== undefined ? <Alert kind="success" className="mb-4">{Number(prontos) > 0 ? `${prontos} modelos criados a partir dos treinos prontos ✅` : "Esses treinos prontos já estão nos seus modelos."}</Alert> : null}
      <ShortcutCard href="/personal/treinos-prontos" emoji="📚" title="Treinos prontos por nível" sub="4 treinos de iniciante, intermediário e avançado para copiar como modelos." className="border-2 border-dashed border-bandeira-500 bg-transparent" />
      {q.data.length ? (
        <LinkButton href="/personal/modelos/aplicar" variant="secondary" icon={Users} className="mb-4">
          Aplicar a vários alunos
        </LinkButton>
      ) : null}
      {!q.data.length ? (
        <EmptyState icon={ClipboardList} title="Nenhum modelo ainda">
          Crie um aqui ou use &quot;Salvar como modelo&quot; em qualquer ficha.
        </EmptyState>
      ) : (
        <View className="gap-2">
          {q.data.map((tp) => (
            <Link key={tp.id} href={`/personal/fichas/${tp.id}`} asChild>
              <Pressable>
                <Card className="flex-row items-center gap-3 p-4">
                  <View className="min-w-0 flex-1">
                    <Text className="font-semibold">{tp.name}</Text>
                    <Text className="text-xs text-muted">
                      {tp.items[0]?.count ?? 0} exercícios{tp.goal ? ` · ${tp.goal}` : ""}
                    </Text>
                  </View>
                  <ChevronRight color={t.muted} size={20} />
                </Card>
              </Pressable>
            </Link>
          ))}
        </View>
      )}
    </Screen>
  );
}
