import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = { title: "Termo de Uso e Privacidade" };

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" aria-label="Início">
        <Logo size={32} />
      </Link>
      <article className="mt-8 space-y-4 leading-relaxed [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold">
        <h1 className="font-display text-3xl font-extrabold">Termo de Uso e Política de Privacidade</h1>
        <p className="text-sm text-muted">Versão 1.0 — vigente a partir de outubro de 2026.</p>

        <h2>1. O que é o BoraTreinar</h2>
        <p>
          O BoraTreinar é uma ferramenta para Personais/Instrutores montarem treinos e acompanharem a
          evolução dos seus alunos, e para alunos registrarem seus treinos.
        </p>

        <h2>2. Dados que coletamos</h2>
        <ul className="list-disc pl-6">
          <li>Cadastro: nome, e-mail, telefone (WhatsApp) e, opcionalmente, data de nascimento.</li>
          <li>Treinos: fichas, exercícios, cargas, repetições, séries realizadas e datas.</li>
          <li>Peso corporal, quando você registrar.</li>
        </ul>
        <p>
          Peso corporal e informações de treino podem ser considerados <strong>dados pessoais sensíveis</strong>{" "}
          (saúde). Eles são tratados com base no seu <strong>consentimento</strong> (art. 11, I, da LGPD), que
          você dá ao aceitar este termo.
        </p>

        <h2>3. Quem vê seus dados</h2>
        <ul className="list-disc pl-6">
          <li>Aluno: você e os Personais vinculados a você (o responsável e, se houver, o compartilhado).</li>
          <li>
            Peso corporal: só fica visível ao Personal se você permitir, e você pode mudar isso a qualquer
            momento.
          </li>
          <li>Nenhum aluno vê dados de outros alunos.</li>
          <li>Não vendemos nem compartilhamos seus dados com terceiros para publicidade.</li>
        </ul>

        <h2>4. Operadores</h2>
        <p>
          Usamos provedores para hospedar o app e o banco de dados (Vercel e Supabase), enviar e-mails
          (Resend) e, opcionalmente, gerar sugestões de treino no relatório semanal por inteligência
          artificial. Nesse caso, enviamos apenas dados agregados de treino, sem nome, e-mail ou telefone.
        </p>

        <h2>5. Seus direitos</h2>
        <p>
          Você pode, a qualquer momento, acessar e corrigir seus dados, exportá-los, revogar o consentimento
          e pedir a exclusão da sua conta, pelas configurações do app. A exclusão apaga definitivamente seus
          dados de treino e de peso.
        </p>

        <h2>6. Segurança</h2>
        <p>
          O acesso aos dados é controlado no banco por regras de segurança por linha (RLS). Ainda assim,
          proteja sua senha e não a compartilhe.
        </p>

        <h2>7. Contato</h2>
        <p>Dúvidas sobre privacidade: fale com o seu Personal ou com o responsável pelo app.</p>
      </article>
    </main>
  );
}
