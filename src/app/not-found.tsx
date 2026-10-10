import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="bg-calcadao flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark size={72} />
      <h1 className="font-display text-3xl font-extrabold">Eita, página não encontrada</h1>
      <p className="text-muted">Esse aparelho não tem aqui na academia. Bora voltar?</p>
      <Link
        href="/"
        className="rounded-2xl bg-bandeira-500 px-5 py-3 font-display font-bold text-white hover:bg-bandeira-600"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
