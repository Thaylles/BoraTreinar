import { loadOpenRequests } from "@/lib/exercise-requests-server";
import { AppHeader, AreaTabs } from "~/components/shell";
import { useData } from "~/lib/data";

export default function AdminTabs() {
  const { data: open } = useData(["exercise-requests-count"], loadOpenRequests);
  return (
    <AreaTabs
      header={() => <AppHeader root="/admin" roleLabel="Administrador" />}
      items={[
        { name: "index", label: "Painel", icon: "chart" },
        { name: "personais", label: "Personais", icon: "user" },
        { name: "alunos", label: "Alunos", icon: "users" },
        { name: "exercicios", label: "Exercícios", icon: "dumbbell" },
        { name: "pedidos", label: "Pedidos", icon: "inbox", badge: open?.length ?? 0 },
      ]}
    />
  );
}
