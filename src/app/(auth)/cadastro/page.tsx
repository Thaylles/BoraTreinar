import type { Metadata } from "next";
import Link from "next/link";
import { SignUpPersonalForm } from "./signup-form";
import { SignUpStudentOpenForm } from "./student-open-form";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const aluno = (await searchParams).tipo === "aluno";
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-border/40 p-1" role="tablist" aria-label="Tipo de conta">
        {[
          { href: "/cadastro?tipo=aluno", label: "Sou aluno", active: aluno },
          { href: "/cadastro", label: "Sou Personal", active: !aluno },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={t.active}
            className={cn(
              "rounded-xl py-2 text-center font-display font-bold",
              t.active ? "bg-surface shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {aluno ? (
        <>
          <h1 className="font-display text-3xl font-extrabold">Sou aluno</h1>
          <p className="mb-6 text-muted">
            Crie sua conta para registrar seus treinos. Depois, se quiser, encontre um Personal para te acompanhar.
          </p>
          <SignUpStudentOpenForm />
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-extrabold">Sou Personal</h1>
          <p className="mb-6 text-muted">Crie sua conta e comece a convidar seus alunos.</p>
          <SignUpPersonalForm />
        </>
      )}
    </>
  );
}
