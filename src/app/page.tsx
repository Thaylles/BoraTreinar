import Link from "next/link";
import {
  CalendarDays,
  ChartLine,
  Dumbbell,
  MessageCircle,
  Timer,
  Trophy,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const recursos = [
  {
    icon: Dumbbell,
    titulo: "Fichas sob medida",
    texto: "O Personal monta Treino A, B, C com séries, carga e descanso.",
  },
  {
    icon: Timer,
    titulo: "Timer de descanso",
    texto: "Marcou a série como feita? O cronômetro já começa a contar.",
  },
  {
    icon: Trophy,
    titulo: "Recordes pessoais",
    texto: "Bateu sua maior carga? A gente comemora junto. Tá pago!",
  },
  {
    icon: ChartLine,
    titulo: "Evolução de verdade",
    texto: "Dashboard semanal e mensal com cargas, volume e frequência.",
  },
  {
    icon: CalendarDays,
    titulo: "Relatório de domingo",
    texto: "Todo domingo às 22h o Personal recebe o resumo da semana.",
  },
  {
    icon: MessageCircle,
    titulo: "Chama no Zap",
    texto: "Um toque e o Personal confirma o treino pelo WhatsApp.",
  },
];

export default function Home() {
  return (
    <main className="bg-calcadao min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Logo size={36} />
        <Link
          href="/entrar"
          className="rounded-full px-4 py-2 text-sm font-semibold text-anil-700 hover:bg-ipe-100 dark:text-ipe-500 dark:hover:bg-surface"
        >
          Entrar
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-4 pt-8 pb-12 text-center sm:pt-16">
        <p className="mb-3 inline-block rounded-full bg-ipe-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-anil-900">
          Feito no Brasil 🇧🇷
        </p>
        <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-anil-700 sm:text-7xl dark:text-foreground">
          Bora <span className="text-bandeira-500">treinar</span>?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          O app que conecta Personal e Aluno: ficha na mão, carga anotada,
          descanso cronometrado e evolução acompanhada de perto.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/cadastro"
            className="w-full rounded-2xl bg-bandeira-500 px-6 py-4 font-display text-lg font-bold text-white shadow-lg shadow-bandeira-500/25 transition hover:bg-bandeira-600 sm:w-auto"
          >
            Sou Personal — criar conta
          </Link>
          <Link
            href="/entrar"
            className="w-full rounded-2xl border-2 border-anil-700 px-6 py-4 font-display text-lg font-bold text-anil-700 transition hover:bg-anil-700 hover:text-white sm:w-auto dark:border-ipe-500 dark:text-ipe-500 dark:hover:bg-ipe-500 dark:hover:text-anil-900"
          >
            Já tenho conta
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">
          É aluno? Peça o link de convite ao seu Personal.
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {recursos.map(({ icon: Icon, titulo, texto }) => (
          <article
            key={titulo}
            className="rounded-3xl border border-border bg-surface p-5 shadow-sm"
          >
            <span className="mb-3 inline-flex size-11 items-center justify-center rounded-2xl bg-bandeira-50 text-bandeira-600 dark:bg-bandeira-700/30 dark:text-bandeira-100">
              <Icon className="size-6" aria-hidden />
            </span>
            <h2 className="font-display text-xl font-bold">{titulo}</h2>
            <p className="mt-1 text-sm text-muted">{texto}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        BoraTreinar · feito com 💚💛 no Brasil
      </footer>
    </main>
  );
}
