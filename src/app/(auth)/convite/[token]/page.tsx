import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { canActAs, getSessionProfile, homeFor } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { acceptInvite } from "./actions";
import { firstName, formatDate } from "@/lib/format";
import { StudentSignUpForm } from "./student-form";

export const metadata: Metadata = { title: "Convite" };

const MOTIVOS: Record<string, string> = {
  usado: "Esse convite já foi usado.",
  expirado: "Esse convite expirou.",
  revogado: "Esse convite foi cancelado pelo Personal.",
};

export default async function ConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const [{ token }, { erro }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data }, session] = await Promise.all([
    supabase.rpc("get_invite_public", { p_token: token }),
    getSessionProfile(),
  ]);
  const invite = data?.[0];

  if (!invite || invite.status !== "pendente") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-5xl" aria-hidden>🫤</p>
        <h1 className="font-display text-2xl font-extrabold">
          {invite ? MOTIVOS[invite.status] : "Convite não encontrado."}
        </h1>
        <p className="text-muted">Peça um novo link de convite ao seu Personal.</p>
        <LinkButton href="/entrar" variant="secondary" className="w-full">
          Já tenho conta
        </LinkButton>
      </div>
    );
  }

  if (session && canActAs(session.profile.role, "aluno")) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-5xl" aria-hidden>🤝</p>
        <h1 className="font-display text-2xl font-extrabold">{firstName(invite.personal_name)} te chamou pra treinar! 💪</h1>
        <p className="text-muted">
          Aceite para treinar com {invite.personal_name} usando a sua conta atual
          {session.profile.role === "admin" ? " (no modo Aluno)" : ""}.
        </p>
        {erro && <Alert className="text-left">{erro}</Alert>}
        <form action={acceptInvite}>
          <input type="hidden" name="token" value={token} />
          <SubmitButton className="w-full" pendingText="Aceitando…">
            Aceitar convite
          </SubmitButton>
        </form>
        <LinkButton href={homeFor(session.profile.role)} variant="secondary" className="w-full">
          Agora não
        </LinkButton>
      </div>
    );
  }

  if (session) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="font-display text-2xl font-extrabold">Você já está logado</h1>
        <p className="text-muted">
          Esse convite é para criar uma conta nova. Saia da conta atual para usá-lo.
        </p>
        <LinkButton href={homeFor(session.profile.role)} className="w-full">
          Ir para o meu painel
        </LinkButton>
      </div>
    );
  }

  return (
    <>
      <p className="mb-2 inline-block rounded-full bg-ipe-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-anil-900">
        Convite
      </p>
      <h1 className="font-display text-3xl font-extrabold leading-tight">
        {firstName(invite.personal_name)} te chamou pra treinar! 💪
      </h1>
      <p className="mb-6 mt-1 text-muted">
        Crie sua conta para acompanhar seus treinos com {invite.personal_name}. Convite válido até{" "}
        {formatDate(invite.expires_at)}.
      </p>
      <StudentSignUpForm token={token} />
    </>
  );
}
