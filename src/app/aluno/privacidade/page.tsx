import type { Metadata } from "next";
import Link from "next/link";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { Card, PageTitle } from "@/components/ui/card";
import { requireStudent } from "@/lib/auth";
import { DeleteAccountForm } from "./delete-form";

export const metadata: Metadata = { title: "Privacidade e meus dados" };

export default async function PrivacidadePage() {
  await requireStudent();
  return (
    <>
      <PageTitle sub="Seus direitos pela LGPD (Lei Geral de Proteção de Dados).">Privacidade e meus dados</PageTitle>

      <Card className="mb-4">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <ShieldCheck className="size-5 text-bandeira-500" aria-hidden /> Quem vê seus dados
        </h2>
        <p className="text-sm text-muted">
          Só você e os Personais vinculados a você veem suas fichas e treinos. O peso só aparece para eles se você permitir na aba{" "}
          <Link href="/aluno/peso" className="font-semibold underline">
            Peso
          </Link>
          . Leia os{" "}
          <Link href="/termos" className="font-semibold underline">
            termos de uso e privacidade
          </Link>
          .
        </p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <Download className="size-5 text-anil-500" aria-hidden /> Baixar meus dados
        </h2>
        <p className="mb-3 text-sm text-muted">
          Um arquivo (JSON) com seu perfil, vínculos, fichas, treinos com todas as séries, pesagens, aulas e notificações.
        </p>
        <a
          href="/api/conta/exportar"
          download
          className="inline-flex items-center gap-2 rounded-2xl border-2 border-border bg-surface px-4 py-2.5 font-display font-bold transition hover:border-bandeira-500"
        >
          <Download className="size-4" aria-hidden /> Baixar meus dados
        </a>
      </Card>

      <Card className="border-pitanga-500/40">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-pitanga-600">
          <Trash2 className="size-5" aria-hidden /> Excluir minha conta
        </h2>
        <p className="mb-3 text-sm text-muted">
          Apaga sua conta e <strong>todos</strong> os seus dados: treinos, pesagens, fichas e aulas. Seus Personais são avisados e
          deixam de ver você. <strong>Não dá para desfazer.</strong> Se quiser guardar seu histórico, baixe seus dados antes.
        </p>
        <DeleteAccountForm />
      </Card>
    </>
  );
}
