import type { Metadata } from "next";
import { SignUpPersonalForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta de Personal" };

export default function CadastroPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Sou Personal</h1>
      <p className="mb-6 text-muted">Crie sua conta e comece a convidar seus alunos.</p>
      <SignUpPersonalForm />
    </>
  );
}
