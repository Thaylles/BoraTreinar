import type { Metadata } from "next";
import { Dumbbell } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, PageTitle } from "@/components/ui/card";
import { NotificationsList } from "@/components/notifications";
import { requireRole } from "@/lib/auth";
import { firstName } from "@/lib/format";

export const metadata: Metadata = { title: "Início" };

export default async function AlunoHome({
  searchParams,
}: {
  searchParams: Promise<{ bemvindo?: string }>;
}) {
  const { profile } = await requireRole("aluno");
  const welcome = (await searchParams).bemvindo === "1";

  return (
    <>
      <PageTitle sub="Partiu treino?">E aí, {firstName(profile.full_name)}! 💪</PageTitle>

      {welcome && (
        <Alert kind="success" className="mb-4">
          Conta criada! Você já está vinculado ao seu Personal. Bem-vindo ao BoraTreinar! 🇧🇷
        </Alert>
      )}

      <Card className="mb-8 flex items-center gap-4 bg-gradient-to-br from-bandeira-500 to-bandeira-700 text-white">
        <Dumbbell className="size-10 shrink-0 text-ipe-400" aria-hidden />
        <div>
          <p className="font-display text-xl font-bold">Seus treinos aparecem aqui</p>
          <p className="text-sm text-white/85">
            Assim que seu Personal montar suas fichas, é só escolher a do dia e mandar ver.
          </p>
        </div>
      </Card>

      <NotificationsList />
    </>
  );
}
