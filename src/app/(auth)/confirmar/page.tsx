import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import { confirmEmailLink } from "../actions";

export const metadata: Metadata = { title: "Confirmar" };

/**
 * Página do link enviado por e-mail. A confirmação acontece no botão (POST), e não ao abrir
 * o link, porque alguns e-mails (Outlook/Hotmail) "visitam" os links antes da pessoa.
 */
export default async function ConfirmarPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;
  if (!token_hash || !type) redirect("/entrar?erro=link");
  const recovery = type === "recovery";
  return (
    <form action={confirmEmailLink} className="space-y-4 text-center">
      <p className="text-5xl" aria-hidden>
        {recovery ? "🔑" : "✅"}
      </p>
      <h1 className="font-display text-2xl font-extrabold">{recovery ? "Criar uma nova senha" : "Confirmar seu e-mail"}</h1>
      <p className="text-muted">Toque no botão para continuar.</p>
      <input type="hidden" name="token_hash" value={token_hash} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value={next ?? ""} />
      <SubmitButton size="lg" className="w-full" pendingText="Abrindo…">
        {recovery ? "Criar nova senha" : "Confirmar e entrar"}
      </SubmitButton>
    </form>
  );
}
