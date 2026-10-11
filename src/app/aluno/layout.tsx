import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth";
import { OutboxSync } from "@/components/workout/outbox-sync";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("aluno");
  return (
    <AppShell
      name={profile.full_name}
      roleLabel="Aluno"
      root="/aluno"
      items={[
        { href: "/aluno", label: "Início", icon: "house" },
        { href: "/aluno/historico", label: "Histórico", icon: "history" },
        { href: "/aluno/peso", label: "Peso", icon: "scale" },
        { href: "/aluno/personais", label: "Personais", icon: "user" },
      ]}
    >
      <OutboxSync />
      {children}
    </AppShell>
  );
}
