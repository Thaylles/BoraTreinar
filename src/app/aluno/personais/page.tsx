import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Mail, ShieldCheck } from "lucide-react";
import { Badge, Card, PageTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { LinkRequestsCard } from "@/components/link-requests-card";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Meus Personais" };

export default async function PersonaisPage({ searchParams }: { searchParams: Promise<{ vinculado?: string }> }) {
  const [{ profile }, { vinculado }] = await Promise.all([requireRole("aluno"), searchParams]);
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("personal_students")
    .select("role, created_at, personal:profiles!personal_students_personal_id_fkey(id, full_name, email, avatar_path)")
    .eq("student_id", profile.id)
    .eq("status", "ativo")
    .order("role");
  const { data: requests } = await supabase
    .from("link_requests")
    .select("id, personal:profiles!link_requests_personal_id_fkey(full_name, avatar_path)")
    .eq("student_id", profile.id)
    .eq("status", "pendente");

  return (
    <>
      <PageTitle sub="Quem acompanha seus treinos.">Meus Personais</PageTitle>
      {vinculado && (
        <Alert kind="success" className="mb-4">
          Convite aceito! Agora esse Personal acompanha seus treinos. 💪
        </Alert>
      )}
      <LinkRequestsCard requests={requests ?? []} />
      {!links?.length && (
        <p className="mb-4 text-sm text-muted">Você ainda não tem Personal. Treinar com acompanhamento faz seus resultados aparecerem mais rápido!</p>
      )}
      <ul className="space-y-3">
        {links?.map((l) => (
          <li key={l.personal?.id}>
            <Card className="flex items-center gap-4">
              <Avatar path={l.personal?.avatar_path} name={l.personal?.full_name ?? "?"} size={48} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.personal?.full_name}</p>
                <p className="flex items-center gap-1 truncate text-sm text-muted">
                  <Mail className="size-3.5" aria-hidden /> {l.personal?.email}
                </p>
                <p className="text-xs text-muted">Desde {formatDate(l.created_at)}</p>
              </div>
              <Badge tone={l.role === "responsavel" ? "green" : "blue"}>
                {l.role === "responsavel" ? "Responsável" : "Compartilhado"}
              </Badge>
            </Card>
          </li>
        ))}
      </ul>
      <LinkButton href="/aluno/encontrar" variant="secondary" className="mt-4 w-full">
        Encontrar um Personal
      </LinkButton>
      <p className="mt-6 text-sm text-muted">
        Todos os Personais listados aqui podem ver suas fichas e seu histórico de treinos. Seu peso só aparece
        para eles se você permitir.
      </p>
      <Link
        href="/aluno/privacidade"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-bandeira-500"
      >
        <ShieldCheck className="size-5 text-bandeira-500" aria-hidden />
        <span className="flex-1 font-semibold">Privacidade e meus dados</span>
        <span className="text-xs text-muted">baixar ou excluir</span>
        <ChevronRight className="size-4 text-muted" aria-hidden />
      </Link>
    </>
  );
}
