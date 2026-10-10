import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function RedefinirSenhaPage() {
  // Chega aqui logado pela sessão de recuperação criada em /auth/confirm.
  if (!(await getSessionProfile())) redirect("/entrar?erro=link");
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Nova senha</h1>
      <p className="mb-6 text-muted">Escolha uma senha nova para sua conta.</p>
      <NewPasswordForm />
    </>
  );
}
