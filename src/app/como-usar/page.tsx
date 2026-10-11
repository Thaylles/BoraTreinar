import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { DemoVideos } from "@/components/demo-videos";

export const metadata: Metadata = { title: "Como usar" };

export default function ComoUsarPage() {
  return (
    <main className="bg-calcadao min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" aria-label="Início">
          <Logo size={32} />
        </Link>
        <Link href="/painel" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-anil-700 hover:bg-ipe-100 dark:text-ipe-500 dark:hover:bg-surface">
          <ArrowLeft className="size-4" aria-hidden /> Voltar ao app
        </Link>
      </header>
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-4">
        <h1 className="text-center font-display text-4xl font-extrabold text-anil-700 dark:text-foreground">Como usar o BoraTreinar</h1>
        <p className="mx-auto mb-8 mt-2 max-w-lg text-center text-muted">
          Dois vídeos curtos, narrados, mostrando o app passo a passo. Ative o som para ouvir a explicação. 🔊
        </p>
        <DemoVideos />
      </section>
    </main>
  );
}
