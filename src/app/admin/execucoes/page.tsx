import type { Metadata } from "next";
import Link from "next/link";
import { CheckCheck, CheckCircle2, Trash2, XCircle } from "lucide-react";
import { Badge, PageTitle } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MediaPreview } from "@/components/exercise-media/media-preview";
import { requireAdmin } from "@/lib/admin-server";
import { equipmentImageSrc, groupLabel } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { PUBLIC_DB, mediaUrl, publicDbMatch } from "@/lib/exercise-media";
import { cn } from "@/lib/cn";
import { approveAllMedia, approveMedia, deleteMedia, rejectMedia } from "./actions";
import { AiPoller, AiVideoButton, BatchGifs, GifForm } from "./media-tools";

export const metadata: Metadata = { title: "Execuções · Admin" };

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "aguardando", label: "Aguardando aprovação" },
  { key: "sem", label: "Sem execução" },
  { key: "aprovados", label: "Aprovados" },
] as const;

const STATUS = {
  gerando: { label: "Gerando…", tone: "blue" },
  rascunho: { label: "Aguardando aprovação", tone: "yellow" },
  aprovado: { label: "Aprovado ✅", tone: "green" },
  rejeitado: { label: "Rejeitado", tone: "red" },
  erro: { label: "Erro", tone: "red" },
} as const;

export default async function ExecucoesPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { db } = await requireAdmin();
  const filtro = (await searchParams).filtro ?? "";
  const [{ data: eqs }, { data: media, error }] = await Promise.all([
    db.from("equipment").select("id, name, muscle_group, image_path, image_url").eq("is_default", true).order("muscle_group").order("name"),
    db.from("exercise_media").select("*").order("created_at", { ascending: false }),
  ]);
  if (error) {
    return (
      <>
        <PageTitle>Execuções dos exercícios</PageTitle>
        <p className="text-sm text-muted">Falta aplicar a atualização do banco (SQL de execuções) no Supabase.</p>
      </>
    );
  }
  const byEq = new Map<string, NonNullable<typeof media>>();
  for (const m of media ?? []) byEq.set(m.equipment_id, [...(byEq.get(m.equipment_id) ?? []), m]);
  const live = (id: string) => (byEq.get(id) ?? []).filter((m) => m.status !== "rejeitado" && m.status !== "erro");
  const list = (eqs ?? []).filter((e) => {
    const ms = byEq.get(e.id) ?? [];
    if (filtro === "aguardando") return ms.some((m) => m.status === "rascunho");
    if (filtro === "sem") return !live(e.id).length;
    if (filtro === "aprovados") return ms.some((m) => m.status === "aprovado");
    return true;
  });
  const approved = (eqs ?? []).filter((e) => (byEq.get(e.id) ?? []).some((m) => m.status === "aprovado")).length;
  const waiting = (media ?? []).filter((m) => m.status === "rascunho").length;
  const waitingEqs = new Set((media ?? []).filter((m) => m.status === "rascunho").map((m) => m.equipment_id)).size;
  const generating = (media ?? []).filter((m) => m.status === "gerando").length;
  const missingWithMatch = (eqs ?? []).filter((e) => !live(e.id).length && publicDbMatch(e.name)).length;

  return (
    <>
      <PageTitle sub="GIFs e vídeos curtos da execução de cada exercício do catálogo. Só o que você aprovar aparece para Personais e alunos.">
        Execuções dos exercícios
      </PageTitle>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-2xl bg-bandeira-50 p-3 dark:bg-bandeira-500/15">
          <p className="font-display text-2xl font-extrabold">{approved}</p>
          <p className="text-xs text-muted">aprovados de {eqs?.length ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-ipe-100 p-3 dark:bg-ipe-500/15">
          <p className="font-display text-2xl font-extrabold">{waiting}</p>
          <p className="text-xs text-muted">aguardando você</p>
        </div>
        <div className="rounded-2xl bg-border/40 p-3">
          <p className="font-display text-2xl font-extrabold">{(eqs ?? []).filter((e) => !live(e.id).length).length}</p>
          <p className="text-xs text-muted">sem execução</p>
        </div>
      </div>

      <details className="mb-4 rounded-2xl bg-anil-700/5 p-4 text-sm dark:bg-white/5">
        <summary className="cursor-pointer font-semibold">De onde vêm os GIFs e vídeos</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>
            <strong className="text-foreground">GIF (grátis):</strong> alterna as fotos de início e fim do movimento do{" "}
            <a href={PUBLIC_DB.url} target="_blank" rel="noopener noreferrer" className="underline">
              {PUBLIC_DB.name}
            </a>
            , que se declara domínio público (Unlicense). A origem das fotos não é documentada; na dúvida, prefira o vídeo de IA.
          </li>
          <li>
            <strong className="text-foreground">Vídeo com IA (pago):</strong> o Google Veo anima a foto do exercício. É cobrado por segundo na
            conta do Gemini e às vezes erra a execução: assista inteiro antes de aprovar.
          </li>
        </ul>
      </details>

      {waitingEqs > 0 && (
        <form action={approveAllMedia} className="mb-4">
          <ConfirmSubmit
            message={`Aprovar as execuções de ${waitingEqs} ${waitingEqs === 1 ? "exercício" : "exercícios"} de uma vez? Elas passam a aparecer para Personais e alunos.`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-bandeira-500 px-4 py-3 font-display font-bold text-white hover:bg-bandeira-600"
          >
            <CheckCheck className="size-5" aria-hidden /> Aprovar todas ({waitingEqs} {waitingEqs === 1 ? "exercício" : "exercícios"})
          </ConfirmSubmit>
          {waiting > waitingEqs && (
            <p className="mt-1 text-center text-xs text-muted">Onde houver mais de uma versão aguardando, a mais recente é aprovada.</p>
          )}
        </form>
      )}

      <AiPoller pending={generating} />
      <BatchGifs missing={missingWithMatch} />

      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4" aria-label="Filtro">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/admin/execucoes?filtro=${f.key}` : "/admin/execucoes"}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold",
              filtro === f.key ? "bg-anil-700 text-white dark:bg-ipe-500 dark:text-anil-900" : "border border-border bg-surface text-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {!list.length && <p className="text-sm text-muted">Nenhum exercício neste filtro.</p>}
      <ul className="space-y-4">
        {list.map((e) => {
          const photo = equipmentImageSrc(e);
          const items = (byEq.get(e.id) ?? []).slice(0, 4);
          return (
            <li key={e.id} id={`eq-${e.id}`} className="scroll-mt-20 rounded-3xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center gap-3">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura
                  <img src={photo} alt="" className="size-14 shrink-0 rounded-xl bg-ipe-100 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold leading-tight">{e.name}</p>
                  <p className="text-xs text-muted">{groupLabel(e.muscle_group)}</p>
                </div>
              </div>

              {items.length > 0 && (
                <ul className="mb-3 grid gap-3 sm:grid-cols-2">
                  {items.map((m) => (
                    <li key={m.id} className="rounded-2xl border border-border p-2">
                      {m.path ? (
                        <MediaPreview url={mediaUrl(m.path)} kind={m.kind} alt={`Execução de ${e.name}`} controls />
                      ) : (
                        <div className="flex aspect-video items-center justify-center rounded-xl bg-border/40 text-sm text-muted">
                          {m.status === "gerando" ? "A IA está gerando…" : "Sem arquivo"}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
                        <span className="text-muted">
                          {m.kind === "gif" ? "GIF · banco público" : "Vídeo · IA"} · {formatDate(m.created_at)}
                        </span>
                      </div>
                      {m.error && <p className="mt-1 text-xs text-pitanga-600">{m.error}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(m.status === "rascunho" || m.status === "rejeitado") && (
                          <form action={approveMedia}>
                            <input type="hidden" name="id" value={m.id} />
                            <button className="inline-flex items-center gap-1 rounded-xl bg-bandeira-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-bandeira-600">
                              <CheckCircle2 className="size-4" aria-hidden /> Aprovar
                            </button>
                          </form>
                        )}
                        {(m.status === "rascunho" || m.status === "aprovado") && (
                          <form action={rejectMedia}>
                            <input type="hidden" name="id" value={m.id} />
                            <button className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15">
                              <XCircle className="size-4" aria-hidden /> {m.status === "aprovado" ? "Tirar do ar" : "Rejeitar"}
                            </button>
                          </form>
                        )}
                        {(m.status === "rejeitado" || m.status === "erro") && (
                          <form action={deleteMedia}>
                            <input type="hidden" name="id" value={m.id} />
                            <ConfirmSubmit message="Apagar este arquivo de vez?" className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-pitanga-600">
                              <Trash2 className="size-3.5" aria-hidden /> Apagar
                            </ConfirmSubmit>
                          </form>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <details className="rounded-2xl bg-anil-700/5 p-3 dark:bg-white/5">
                <summary className="cursor-pointer text-sm font-semibold">{items.length ? "Gerar outra versão" : "Gerar execução"}</summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <GifForm equipmentId={e.id} suggestion={publicDbMatch(e.name)} />
                  <AiVideoButton equipmentId={e.id} photo={photo} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
