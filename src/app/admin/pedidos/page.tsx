import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/card";
import { RequestsPanel } from "@/components/exercise-requests/requests-panel";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Exercícios pedidos · Admin" };

export default async function AdminPedidosPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireRole("admin");
  return (
    <>
      <PageTitle sub="Pedidos dos alunos. Adicione ao catálogo padrão, aponte um exercício que já existe ou descarte.">
        Exercícios pedidos
      </PageTitle>
      <RequestsPanel isAdmin blocked={false} back="/admin/pedidos" ok={(await searchParams).ok} />
    </>
  );
}
