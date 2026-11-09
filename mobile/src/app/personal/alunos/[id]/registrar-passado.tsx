import { useLocalSearchParams } from "expo-router";
import { Users } from "lucide-react-native";
import { firstName } from "@/lib/format";
import { dayLabel } from "@/lib/schedule";
import { BACKDATE_MAX_DAYS, backdateDays } from "@/lib/session-window";
import { spDateKey, spTimeKey } from "@/lib/week";
import { useData } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { Alert, EmptyState, Loading, PageTitle, Screen, Text } from "~/ui";
import { BackdateForm } from "~/components/backdate-form";

export default function RegistrarPassadoDoAluno() {
  const { id, erro } = useLocalSearchParams<{ id: string; erro?: string }>();
  const q = useData(["backdate-for", id], async () => {
    const [{ data: student }, { data: plans }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", id).maybeSingle(),
      supabase.from("workout_plans").select("id, name").eq("student_id", id).eq("is_template", false).is("archived_at", null).order("name"),
    ]);
    return { student, plans: plans ?? [] };
  });
  if (q.isLoading) return <Loading />;
  if (!q.data?.student)
    return (
      <Screen edges={[]}>
        <EmptyState icon={Users} title="Aluno não encontrado" />
      </Screen>
    );
  const today = spDateKey();
  const name = firstName(q.data.student.full_name);
  return (
    <Screen edges={[]}>
      <PageTitle sub={`Lance um treino de ${name} dos últimos ${BACKDATE_MAX_DAYS} dias que ficou sem registro.`}>Treino esquecido</PageTitle>
      {erro ? <Alert className="mb-4">{`Só dá para registrar treinos de hoje até ${BACKDATE_MAX_DAYS} dias atrás, sem horário no futuro. Escolha de novo.`}</Alert> : null}
      {q.data.plans.length ? (
        <BackdateForm plans={q.data.plans} days={backdateDays(today).map((d) => ({ value: d, label: dayLabel(d, today) }))} today={today} nowTime={spTimeKey()} planBase={`/personal/alunos/${id}/registrar`} who={name} />
      ) : (
        <Text className="text-sm text-muted">Monte uma ficha para o aluno antes de registrar um treino.</Text>
      )}
    </Screen>
  );
}
