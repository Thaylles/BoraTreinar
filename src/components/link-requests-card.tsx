import { Check, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { respondLinkRequest } from "@/app/aluno/vinculo-actions";
import { firstName } from "@/lib/format";

type Req = { id: string; personal: { full_name: string; avatar_path: string | null } | null };

/** Pedidos de Personais para acompanhar o aluno (aceitar/recusar). */
export function LinkRequestsCard({ requests }: { requests: Req[] }) {
  if (!requests.length) return null;
  return (
    <section aria-label="Pedidos de acompanhamento" className="mb-6 space-y-2">
      {requests.map((r) => {
        const name = r.personal?.full_name ?? "Personal";
        return (
          <div key={r.id} className="rounded-3xl border-2 border-bandeira-500 bg-surface p-4">
            <div className="flex items-center gap-3">
              <Avatar path={r.personal?.avatar_path} name={name} size={48} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{name} quer te acompanhar 💪</p>
                <p className="text-sm text-muted">
                  Aceitando, {firstName(name)} pode montar suas fichas e ver seus treinos. Seu peso só aparece se você permitir.
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <form action={respondLinkRequest} className="flex-1">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="accept" value="1" />
                <Button className="w-full">
                  <Check className="size-4" aria-hidden /> Aceitar
                </Button>
              </form>
              <form action={respondLinkRequest}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="accept" value="0" />
                <Button variant="ghost">
                  <X className="size-4" aria-hidden /> Recusar
                </Button>
              </form>
            </div>
          </div>
        );
      })}
    </section>
  );
}
