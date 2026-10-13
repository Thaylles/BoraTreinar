import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth";
import { OutboxSync } from "@/components/workout/outbox-sync";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("aluno");
  return (
    <AppShell
      name={profile.full_name}
      avatarPath={profile.avatar_path}
      roleLabel={profile.role === "admin" ? "Admin · modo aluno" : "Aluno"}
      root="/aluno"
      isAdmin={profile.role === "admin"}
      items={[
        { href: "/aluno", label: "Início", icon: "house" },
        { href: "/aluno/evolucao", label: "Evolução", icon: "chart" },
        { href: "/aluno/historico", label: "Histórico", icon: "history" },
        { href: "/aluno/peso", label: "Peso", icon: "scale" },
        { href: "/aluno/aulas", label: "Aulas", icon: "calendar" },
        { href: "/aluno/personais", label: "Personais", icon: "user" },
      ]}
    >
      <OutboxSync />
      {children}
    </AppShell>
  );
}
