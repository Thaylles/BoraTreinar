import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles, UserSearch } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, pricePerClass } from "@/lib/finance";
import { firstName } from "@/lib/format";

export const metadata: Metadata = { title: "Encontrar um Personal" };

export default async function EncontrarPersonalPage() {
  const { profile } = await requireRole("aluno");
  const supabase = await createClient();
  const { data } = await supabase.rpc("personal_directory");
  const personals = (data ?? []).filter((p) => p.id !== profile.id);

  return (
    <>
      <Link href="/aluno/personais" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Meus Personais
      </Link>
      <PageTitle sub="Opcional, mas faz diferença: com um Personal você treina com ficha montada para você, corrige a execução e evolui mais rápido.">
        Encontre um Personal
      </PageTitle>

      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-ipe-100 p-4 text-sm text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400">
        <Sparkles className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          Chame no WhatsApp para combinar. Depois, o Personal te adiciona pelo seu e-mail ou WhatsApp e você só confirma aqui
          no app.
        </p>
      </div>

      {!personals.length ? (
        <EmptyState icon={<UserSearch className="size-8" />} title="Nenhum Personal disponível ainda">
          Novos Personais aparecem aqui assim que se cadastram. Enquanto isso, você já pode registrar seus treinos.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {personals.map((p) => (
            <li key={p.id} className="rounded-3xl border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <Avatar path={p.avatar_path} name={p.full_name} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold">{p.full_name}</p>
                  <p className="text-sm text-muted">{p.age ? `${p.age} anos` : "Personal Trainer"}</p>
                  <p className="text-sm">
                    {p.min_class_price != null ? (
                      <>
                        a partir de <strong>{brl(Number(p.min_class_price))}</strong> por aula
                      </>
                    ) : (
                      <span className="text-muted">Valor a combinar</span>
                    )}
                  </p>
                </div>
              </div>
              {p.packages.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {p.packages.map((k) => (
                    <li key={k.name} className="rounded-full bg-border/50 px-3 py-1 text-xs">
                      <strong>{k.name}</strong> ·{" "}
                      {k.kind === "mensal" ? `${brl(Number(k.price))}/mês (≈ ${brl(pricePerClass(k))}/aula)` : `${brl(Number(k.price))} por aula`}
                    </li>
                  ))}
                </ul>
              )}
              <WhatsAppButton
                phone={p.phone}
                className="mt-3 w-full"
                text={`Olá, ${firstName(p.full_name)}! Te encontrei no BoraTreinar e quero saber mais sobre suas aulas. Meu nome é ${profile.full_name}.`}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
