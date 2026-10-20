import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/card";
import { RequestsPanel } from "@/components/exercise-requests/requests-panel";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Exercícios pedidos" };

export default async function PedidosExercicioPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { profile } = await requireRole("personal");
  return (
    <>
      <Link href="/personal/exercicios" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Exercícios
      </Link>
      <PageTitle sub="Alunos não encontraram estes exercícios. Ao adicionar, ele entra no catálogo padrão para todos e quem pediu é avisado.">
        Exercícios pedidos
      </PageTitle>
      <RequestsPanel isAdmin={profile.role === "admin"} blocked={profile.catalog_blocked} back="/personal/exercicios/pedidos" ok={(await searchParams).ok} />
    </>
  );
}
