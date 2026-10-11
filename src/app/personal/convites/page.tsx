import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { requireRole } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { formatDate, relativeDays } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { revokeInvite } from "../actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Convites" };

type Status = "pendente" | "usado" | "expirado" | "revogado";

function statusOf(i: Tables<"invites">, now: Date): Status {
  if (i.revoked_at) return "revogado";
  if (i.used_at) return "usado";
  if (new Date(i.expires_at) <= now) return "expirado";
  return "pendente";
}

const BADGE: Record<Status, { tone: "green" | "yellow" | "red" | "neutral"; text: string }> = {
  pendente: { tone: "yellow", text: "Pendente" },
  usado: { tone: "green", text: "Usado" },
  expirado: { tone: "neutral", text: "Expirado" },
  revogado: { tone: "red", text: "Revogado" },
};

export default async function ConvitesPage() {
  await requireRole("personal");
  const supabase = await createClient();
  const { data: invites } = await supabase
    .from("invites")
    .select("*, used_by_profile:profiles!invites_used_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const now = new Date();

  return (
    <>
      <PageTitle sub="Gere um link e mande para o aluno. Ao se cadastrar, ele já fica vinculado a você.">
        Convites
      </PageTitle>

      <Card className="mb-8">
        <InviteForm appUrl={appUrl} />
      </Card>

      <h2 className="mb-3 font-display text-xl font-bold">Seus convites</h2>
      {!invites?.length ? (
        <EmptyState icon={<Ticket className="size-8" />} title="Nenhum convite ainda">
          Gere o primeiro link acima.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {invites.map((inv) => {
            const status = statusOf(inv, now);
            const link = `${appUrl}/convite/${inv.token}`;
            return (
              <li key={inv.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{inv.label || "Convite sem nome"}</p>
                      <p className="text-xs text-muted">
                        Criado em {formatDate(inv.created_at)} ·{" "}
                        {status === "pendente"
                          ? `expira ${relativeDays(inv.expires_at, now)}`
                          : status === "usado"
                            ? `usado por ${inv.used_by_profile?.full_name ?? "aluno"}`
                            : `válido até ${formatDate(inv.expires_at)}`}
                      </p>
                    </div>
                    <Badge tone={BADGE[status].tone}>{BADGE[status].text}</Badge>
                  </div>
                  {status === "pendente" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CopyButton text={link} />
                      <form action={revokeInvite}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button className="rounded-xl px-3 py-1.5 text-sm font-semibold text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15">
                          Revogar
                        </button>
                      </form>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
