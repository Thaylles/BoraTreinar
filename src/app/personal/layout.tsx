import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth";
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
      roleLabel="Personal"
      root="/personal"
      items={[
        { href: "/personal", label: "Início", icon: "house" },
        { href: "/personal/alunos", label: "Alunos", icon: "users" },
        { href: "/personal/exercicios", label: "Exercícios", icon: "dumbbell" },
        { href: "/personal/convites", label: "Convites", icon: "ticket" },
        { href: "/personal/solicitacoes", label: "Pedidos", icon: "inbox", badge: count ?? 0 },
      ]}
    >
      {children}
    </AppShell>
  );
}
