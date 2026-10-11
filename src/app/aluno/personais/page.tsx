import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Mail, ShieldCheck } from "lucide-react";
import { Badge, Card, PageTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meus Personais" };

export default async function PersonaisPage() {
  const { profile } = await requireRole("aluno");
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("personal_students")
    .select("role, created_at, personal:profiles!personal_students_personal_id_fkey(id, full_name, email)")
    .eq("student_id", profile.id)
    .eq("status", "ativo")
    .order("role");

  return (
    <>
      <PageTitle sub="Quem acompanha seus treinos.">Meus Personais</PageTitle>
      <ul className="space-y-3">
        {links?.map((l) => (
          <li key={l.personal?.id}>
            <Card className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-anil-700 font-display text-xl font-bold text-white">
                {l.personal?.full_name.charAt(0).toUpperCase()}
              </span>
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
