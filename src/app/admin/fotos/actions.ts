"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-server";
import { EQUIPMENT_BUCKET, groupLabel } from "@/lib/catalog";
import type { ActionState } from "@/lib/errors";
import { STYLE_REFERENCES, catalogImagePrompt } from "@/lib/exercise-media";
import { generateCatalogImage } from "@/lib/exercise-media-server";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const CREDIT = "Ilustração BoraTreinar (gerada com IA e aprovada pelo administrador)";

/** Endereço do próprio site (para buscar as fotos de referência em /catalogo). */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Gera com IA a foto de um exercício no estilo do catálogo. Não salva nada: a imagem volta
 * para o admin conferir e aprovar (ou gerar outra).
 */
export async function generatePhoto(equipmentId: string, hint: string): Promise<{ error?: string; image?: string }> {
  const { db } = await requireAdmin();
  if (!isUuid(equipmentId)) return { error: "Exercício inválido." };
  const { data: eq } = await db.from("equipment").select("name, muscle_group, description").eq("id", equipmentId).maybeSingle();
  if (!eq) return { error: "Exercício não encontrado." };
  try {
    const base = await origin();
    const references = await Promise.all(
      STYLE_REFERENCES.map(async (path) => {
        const res = await fetch(base + path, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error("não foi possível ler as fotos de referência do catálogo");
        return { mimeType: "image/webp", base64: Buffer.from(await res.arrayBuffer()).toString("base64") };
      }),
    );
    const prompt = catalogImagePrompt({
      name: eq.name,
      group: groupLabel(eq.muscle_group),
      description: eq.description,
      hint: hint.trim() || null,
    });
    const img = await generateCatalogImage(prompt, references);
    return { image: `data:${img.mimeType};base64,${img.base64}` };
  } catch (e) {
    return { error: `Não deu para gerar a foto: ${e instanceof Error ? e.message : "erro"}.` };
  }
}

/** Aprova a foto gerada (já convertida para WebP/JPEG no navegador): vira a foto do exercício. */
export async function savePhoto(equipmentId: string, dataUrl: string): Promise<ActionState> {
  const { db, profile } = await requireAdmin();
  if (!isUuid(equipmentId)) return { error: "Exercício inválido." };
  const m = /^data:(image\/(webp|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { error: "Imagem inválida." };
  const bytes = Buffer.from(m[3], "base64");
  if (bytes.length > 2 * 1024 * 1024) return { error: "Imagem muito grande (máx. 2 MB)." };
  const { data: current } = await db.from("equipment").select("image_path").eq("id", equipmentId).maybeSingle();
  if (!current) return { error: "Exercício não encontrado." };

  const path = `admin/ia-${crypto.randomUUID()}.${m[2] === "jpeg" ? "jpg" : "webp"}`;
  const { error: upErr } = await db.storage.from(EQUIPMENT_BUCKET).upload(path, bytes, { contentType: m[1], cacheControl: "31536000" });
  if (upErr) return { error: "Não foi possível salvar a imagem. Tenta de novo?" };
  const { error } = await db
    .from("equipment")
    .update({ image_path: path, image_credit: CREDIT, image_updated_by: profile.id, image_updated_at: new Date().toISOString() })
    .eq("id", equipmentId);
  if (error) {
    await db.storage.from(EQUIPMENT_BUCKET).remove([path]);
    return { error: "Não foi possível trocar a foto." };
  }
  if (current.image_path) await db.storage.from(EQUIPMENT_BUCKET).remove([current.image_path]);
  revalidatePath("/admin/fotos");
  revalidatePath("/", "layout");
  return { ok: "Foto aprovada ✅" };
}
