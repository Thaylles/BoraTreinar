import { useLocalSearchParams } from "expo-router";
import { dayLabel } from "@/lib/schedule";
import { BACKDATE_MAX_DAYS, backdateDays } from "@/lib/session-window";
import { spDateKey, spTimeKey } from "@/lib/week";
import { useData } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Alert, Loading, PageTitle, Screen } from "~/ui";
import { BackdateForm } from "~/components/backdate-form";

export default function RegistrarPassado() {
  const { erro } = useLocalSearchParams<{ erro?: string }>();
  const profile = useProfile();
  const q = useData(["backdate-plans", profile.id], async () =>
    (await supabase.from("workout_plans").select("id, name").eq("student_id", profile.id).eq("is_template", false).is("archived_at", null).order("name")).data ?? [],
  );
  if (!q.data) return <Loading />;
  const today = spDateKey();
  return (
    <Screen edges={[]}>
      <PageTitle sub={`Esqueceu de registrar? Lance aqui um treino dos últimos ${BACKDATE_MAX_DAYS} dias.`}>Treino esquecido</PageTitle>
      {erro ? <Alert className="mb-4">{`Só dá para registrar treinos de hoje até ${BACKDATE_MAX_DAYS} dias atrás, sem horário no futuro. Escolha de novo.`}</Alert> : null}
      <BackdateForm plans={q.data} days={backdateDays(today).map((d) => ({ value: d, label: dayLabel(d, today) }))} today={today} nowTime={spTimeKey()} planBase="/aluno/treinar" freeHref="/aluno/livre" />
    </Screen>
  );
}
