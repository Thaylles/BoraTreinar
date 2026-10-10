import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("aluno");
  return (
    <AppShell
      name={profile.full_name}
      roleLabel="Aluno"
      root="/aluno"
      items={[
        { href: "/aluno", label: "Início", icon: "house" },
        { href: "/aluno/personais", label: "Personais", icon: "user" },
      ]}
    >
      {children}
    </AppShell>
  );
}
