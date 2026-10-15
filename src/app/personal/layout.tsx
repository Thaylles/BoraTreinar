import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth";
import { OutboxSync } from "@/components/workout/outbox-sync";
import { createClient } from "@/lib/supabase/server";

export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("personal");
  const supabase = await createClient();
  const { count } = await supabase
    .from("student_transfers")
    .select("id", { count: "exact", head: true })
    .eq("to_personal_id", profile.id)
    .eq("status", "pendente");

  return (
    <AppShell
      name={profile.full_name}
      avatarPath={profile.avatar_path}
      roleLabel={profile.role === "admin" ? "Admin · modo Personal" : "Personal"}
      root="/personal"
      isAdmin={profile.role === "admin"}
      items={[
        { href: "/personal", label: "Início", icon: "house" },
        { href: "/personal/alunos", label: "Alunos", icon: "users" },
        { href: "/personal/agenda", label: "Agenda", icon: "calendar" },
        { href: "/personal/exercicios", label: "Exercícios", icon: "dumbbell" },
        { href: "/personal/financeiro", label: "Financeiro", icon: "wallet" },
        { href: "/personal/solicitacoes", label: "Pedidos", icon: "inbox", badge: count ?? 0 },
      ]}
    >
      <OutboxSync />
      {children}
    </AppShell>
  );
}
