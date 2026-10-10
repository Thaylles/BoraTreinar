import Link from "next/link";

export function TermsCheckbox() {
  return (
    <label className="flex items-start gap-3 rounded-2xl bg-background p-3 text-sm">
      <input
        type="checkbox"
        name="terms"
        required
        className="mt-0.5 size-5 shrink-0 accent-bandeira-500"
      />
      <span>
        Li e aceito o{" "}
        <Link href="/termos" target="_blank" className="font-semibold text-bandeira-600 underline">
          Termo de Uso e Política de Privacidade
        </Link>
        , incluindo o tratamento dos meus dados de treino e saúde conforme a LGPD.
      </span>
    </label>
  );
}
