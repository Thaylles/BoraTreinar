"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-server";
import type { ActionState } from "@/lib/errors";
import { MEDIA_BUCKET, PUBLIC_DB, publicDbMatch, videoPrompt } from "@/lib/exercise-media";
import { buildPublicDbGif, checkVeo, downloadVeo, startVeo } from "@/lib/exercise-media-server";
import { groupLabel } from "@/lib/catalog";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const refresh = () => {
  revalidatePath("/admin/execucoes");
  // A execução aprovada aparece nas telas de exercício e no treino.
  revalidatePath("/", "layout");
};

type Db = Awaited<ReturnType<typeof requireAdmin>>["db"];

/** Gera o GIF do banco público para um exercício e salva como rascunho. */
async function gifFor(db: Db, adminId: string, equipmentId: string, datasetId: string) {
  const gif = await buildPublicDbGif(datasetId);
  const path = `gif/${equipmentId}/${crypto.randomUUID()}.gif`;
  const { error: upErr } = await db.storage.from(MEDIA_BUCKET).upload(path, gif, { contentType: "image/gif", cacheControl: "31536000" });
  if (upErr) throw new Error("não foi possível salvar o GIF");
  const { error } = await db.from("exercise_media").insert({
    equipment_id: equipmentId,
    kind: "gif",
    source: "banco_publico",
    status: "rascunho",
    path,
    credit: `Fotos: ${PUBLIC_DB.name} (${datasetId.replace(/_/g, " ")}), licença Unlicense`,
    created_by: adminId,
  });
  if (error) {
    await db.storage.from(MEDIA_BUCKET).remove([path]);
    throw new Error("não foi possível registrar o GIF");
  }
}

/** GIF de um exercício (o admin pode trocar a correspondência no banco público). */
export async function generateGif(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, profile } = await requireAdmin();
  const equipmentId = String(fd.get("equipment_id") ?? "");
  const datasetId = String(fd.get("dataset_id") ?? "").trim();
  if (!isUuid(equipmentId) || !datasetId) return { error: "Escolha o exercício do banco público." };
  try {
    await gifFor(db, profile.id, equipmentId, datasetId);
  } catch (e) {
    return { error: `Não deu para gerar o GIF: ${e instanceof Error ? e.message : "erro"}.` };
  }
  refresh();
  return { ok: "GIF gerado! Confira e aprove." };
}

/** Gera em lote os GIFs dos exercícios do catálogo que ainda não têm nenhuma execução (até `max` por vez). */
export async function generateMissingGifs(max = 6): Promise<{ done: number; left: number; errors: string[] }> {
  const { db, profile } = await requireAdmin();
  const [{ data: eqs }, { data: media }] = await Promise.all([
    db.from("equipment").select("id, name").eq("is_default", true).order("name"),
    db.from("exercise_media").select("equipment_id, status"),
  ]);
  const has = new Set((media ?? []).filter((m) => m.status !== "rejeitado" && m.status !== "erro").map((m) => m.equipment_id));
  const todo = (eqs ?? []).filter((e) => !has.has(e.id) && publicDbMatch(e.name));
  const errors: string[] = [];
  let done = 0;
  for (const e of todo.slice(0, Math.min(max, 10))) {
    try {
      await gifFor(db, profile.id, e.id, publicDbMatch(e.name)!);
      done++;
    } catch (err) {
      errors.push(`${e.name}: ${err instanceof Error ? err.message : "erro"}`);
    }
  }
  refresh();
  return { done, left: Math.max(0, todo.length - done - errors.length), errors };
}

/**
 * Começa o vídeo de IA a partir da foto do exercício (JPEG em base64, convertido no navegador).
 * A geração leva alguns minutos; a página acompanha com refreshAiVideos.
 */
export async function startAiVideo(equipmentId: string, imageBase64: string): Promise<ActionState> {
  const { db, profile } = await requireAdmin();
  if (!isUuid(equipmentId)) return { error: "Exercício inválido." };
  if (!imageBase64 || imageBase64.length > 900_000) return { error: "Foto inválida ou grande demais." };
  const { data: eq } = await db.from("equipment").select("name, muscle_group, description").eq("id", equipmentId).maybeSingle();
  if (!eq) return { error: "Exercício não encontrado." };
  try {
    const { operation, model } = await startVeo(
      imageBase64,
      videoPrompt({ name: eq.name, group: groupLabel(eq.muscle_group), description: eq.description }),
    );
    await db.from("exercise_media").insert({
      equipment_id: equipmentId,
      kind: "video",
      source: "ia",
      status: "gerando",
      operation,
      credit: `Vídeo gerado por IA (Google ${model}) a partir da foto do catálogo`,
      created_by: profile.id,
    });
  } catch (e) {
    return { error: `A IA não começou o vídeo: ${e instanceof Error ? e.message : "erro"}.` };
  }
  refresh();
  return { ok: "Vídeo em produção pela IA (leva de 1 a 3 minutos). Pode continuar usando a página." };
}

/** Confere os vídeos em produção; os prontos viram rascunho para aprovação. Retorna quantos ainda faltam. */
export async function refreshAiVideos(): Promise<{ pending: number; finished: number }> {
  const { db } = await requireAdmin();
  const { data: rows } = await db.from("exercise_media").select("id, equipment_id, operation").eq("status", "gerando").limit(10);
  let finished = 0;
  for (const r of rows ?? []) {
    try {
      const st = await checkVeo(r.operation ?? "");
      if (!st.done) continue;
      finished++;
      if ("error" in st) {
        await db.from("exercise_media").update({ status: "erro", error: st.error }).eq("id", r.id);
        continue;
      }
      const mp4 = await downloadVeo(st.videoUri);
      const path = `video/${r.equipment_id}/${crypto.randomUUID()}.mp4`;
      const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, mp4, { contentType: "video/mp4", cacheControl: "31536000" });
      await db
        .from("exercise_media")
        .update(error ? { status: "erro", error: "não foi possível salvar o vídeo" } : { status: "rascunho", path, operation: null })
        .eq("id", r.id);
    } catch (e) {
      await db.from("exercise_media").update({ status: "erro", error: e instanceof Error ? e.message.slice(0, 300) : "erro" }).eq("id", r.id);
      finished++;
    }
  }
  if (finished) refresh();
  return { pending: (rows?.length ?? 0) - finished, finished };
}

/** Aprova uma execução (a aprovada anterior do mesmo exercício volta para rascunho). */
export async function approveMedia(fd: FormData) {
  const { db, profile } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return;
  const { data: m } = await db.from("exercise_media").select("equipment_id, status").eq("id", id).maybeSingle();
  if (!m || !["rascunho", "rejeitado"].includes(m.status)) return;
  await db.from("exercise_media").update({ status: "rascunho" }).eq("equipment_id", m.equipment_id).eq("status", "aprovado");
  await db.from("exercise_media").update({ status: "aprovado", reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq("id", id);
  refresh();
}

/** Rejeita (ou tira do ar, se estava aprovada). */
export async function rejectMedia(fd: FormData) {
  const { db, profile } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return;
  await db
    .from("exercise_media")
    .update({ status: "rejeitado", reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["rascunho", "aprovado"]);
  refresh();
}

/** Apaga de vez uma execução rejeitada ou com erro (e o arquivo). */
export async function deleteMedia(fd: FormData) {
  const { db } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return;
  const { data: m } = await db.from("exercise_media").select("path, status").eq("id", id).maybeSingle();
  if (!m || !["rejeitado", "erro"].includes(m.status)) return;
  if (m.path) await db.storage.from(MEDIA_BUCKET).remove([m.path]);
  await db.from("exercise_media").delete().eq("id", id);
  refresh();
}
