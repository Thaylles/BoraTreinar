import { AppHeader, AreaTabs } from "~/components/shell";
import { useData } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";

export default function PersonalTabs() {
  const profile = useProfile();
  const { data: count } = useData(["transfers-count", profile.id], async () => (await supabase.from("student_transfers").select("id", { count: "exact", head: true }).eq("to_personal_id", profile.id).eq("status", "pendente")).count ?? 0);
  return (
    <AreaTabs
      header={() => <AppHeader root="/personal" roleLabel={profile.role === "admin" ? "Admin · modo Personal" : "Personal"} />}
      items={[
        { name: "index", label: "Início", icon: "house" },
        { name: "alunos", label: "Alunos", icon: "users" },
        { name: "agenda", label: "Agenda", icon: "calendar" },
        { name: "exercicios", label: "Exercícios", icon: "dumbbell" },
        { name: "financeiro", label: "Financeiro", icon: "wallet" },
        { name: "solicitacoes", label: "Pedidos", icon: "inbox", badge: count ?? 0 },
      ]}
    />
  );
}
