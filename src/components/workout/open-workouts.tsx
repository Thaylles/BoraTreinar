"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, Trash2 } from "lucide-react";
import { draftStore } from "@/lib/outbox";

type StoredDraft = {
  v: 1;
  startedAt: string;
  title?: string;
  href?: string;
  exercises: { sets: { done: boolean | null }[] }[];
};
type Open = {
  key: string;
  title: string;
  href: string;
  startedAt: string;
  done: number;
};

/** Rascunhos de treino guardados no aparelho (com o prefixo dado) que já têm alguma série feita. */
function findOpen(prefixes: string[]): Open[] {
  const found: Open[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !prefixes.some((p) => key.startsWith(p))) continue;
      const d = draftStore.get<StoredDraft>(key);
      if (d?.v !== 1 || !d.href || !d.title) continue;
      const done = d.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.done === true).length, 0);
      if (done > 0)
        found.push({
          key,
          title: d.title,
          href: d.href,
          startedAt: d.startedAt,
          done,
        });
    }
  } catch {
    /* armazenamento indisponível */
  }
  return found.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

const when = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `hoje às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
};

/** "Você tem um treino em aberto": retomar de onde parou ou descartar. */
export function OpenWorkouts({ prefixes }: { prefixes: string[] }) {
  const [open, setOpen] = useState<Open[]>([]);
  const key = prefixes.join("|");
  useEffect(() => setOpen(findOpen(key.split("|"))), [key]);

  if (!open.length) return null;
  return (
    <div className="mb-4 space-y-2">
      {open.map((o) => (
        <div key={o.key} className="rounded-3xl border-2 border-ipe-500 bg-ipe-100 dark:bg-ipe-500/10 p-4">
          <p className="flex items-center gap-2 font-display font-bold">
            <History className="size-5 shrink-0" aria-hidden /> Treino em aberto: {o.title}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Começou {when(o.startedAt)} · {o.done} {o.done === 1 ? "série feita" : "séries feitas"}. Retome para finalizar e salvar.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={o.href}
              className="inline-flex items-center gap-2 rounded-2xl bg-bandeira-500 px-4 py-2 font-display font-bold text-white hover:bg-bandeira-600"
            >
              Retomar
            </Link>
            <button
              type="button"
              onClick={() => {
                if (!confirm(`Descartar o treino ${o.title}? As séries marcadas serão perdidas.`)) return;
                draftStore.remove(o.key);
                setOpen((list) => list.filter((x) => x.key !== o.key));
              }}
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-muted hover:bg-border/50 hover:text-pitanga-600"
            >
              <Trash2 className="size-4" aria-hidden /> Descartar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
