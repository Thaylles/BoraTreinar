import { useQuery } from "@tanstack/react-query";
import { AppHeader, AreaTabs } from "~/components/shell";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";

export default function AlunoTabs() {
  const profile = useProfile();
  const coach = profile.role === "personal";
  // Marca do Personal (Premium): o aluno vê o logo de quem o acompanha.
  const { data: brand } = useQuery({
    queryKey: ["my-personal-logo"],
    enabled: !coach,
    queryFn: async () => (await supabase.rpc("my_personal_logo").maybeSingle()).data ?? null,
  });
  return (
    <AreaTabs
      header={() => (
        <AppHeader
          root="/aluno"
          roleLabel={profile.role === "admin" ? "Admin · modo aluno" : coach ? "Personal · meu treino" : "Aluno"}
          profileHref={coach ? "/personal/perfil" : undefined}
          brand={brand ? { logoPath: brand.logo_path, name: brand.full_name } : null}
        />
      )}
      items={[
        { name: "index", label: "Início", icon: "house" },
        { name: "evolucao", label: "Evolução", icon: "chart" },
        { name: "historico", label: "Histórico", icon: "history" },
        { name: "peso", label: "Peso", icon: "scale" },
        { name: "aulas", label: "Aulas", icon: "calendar", hidden: coach },
        { name: "personais", label: "Personais", icon: "user", hidden: coach },
      ]}
    />
  );
}
