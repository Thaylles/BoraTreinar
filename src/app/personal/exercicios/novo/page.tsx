import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, PageTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { EquipmentForm } from "../equipment-form";

export const metadata: Metadata = { title: "Novo exercício" };

export default async function NovoExercicioPage() {
  const { profile } = await requireRole("personal");
  return (
    <>
      <Link href="/personal/exercicios" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Exercícios
      </Link>
      <PageTitle sub="Fica disponível para você e para os seus alunos.">Novo exercício</PageTitle>
      <Card>
        {profile.catalog_blocked ? (
          <p className="text-sm text-muted">🔒 Sua conta está sem permissão para criar exercícios. Fale com o administrador.</p>
        ) : (
          <EquipmentForm userId={profile.id} />
        )}
      </Card>
    </>
  );
}
