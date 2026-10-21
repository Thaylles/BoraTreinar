import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth";
import { loadOpenRequests } from "@/lib/exercise-requests-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("admin");
  const requests = await loadOpenRequests();
  return (
    <AppShell
      name={profile.full_name}
      avatarPath={profile.avatar_path}
      roleLabel="Administrador"
      isAdmin
      root="/admin"
      items={[
        { href: "/admin", label: "Painel", icon: "chart" },
        { href: "/admin/personais", label: "Personais", icon: "user" },
        { href: "/admin/alunos", label: "Alunos", icon: "users" },
        { href: "/admin/exercicios", label: "Exercícios", icon: "dumbbell" },
        { href: "/admin/pedidos", label: "Pedidos", icon: "inbox", badge: requests.length },
        { href: "/admin/execucoes", label: "Execuções", icon: "film" },
      ]}
    >
      {children}
    </AppShell>
  );
}
