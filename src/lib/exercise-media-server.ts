import "server-only";
import jpeg from "jpeg-js";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { PUBLIC_DB } from "@/lib/exercise-media";

/** Baixa um arquivo com tempo limite (erro com mensagem curta em português). */
async function download(url: string, headers: Record<string, string> = {}, timeoutMs = 30_000): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`não foi possível baixar (HTTP ${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

type Frame = { width: number; height: number; data: Uint8Array };

/** Redimensiona (bilinear) um quadro RGBA para o tamanho pedido. */
function resize(src: Frame, width: number, height: number): Frame {
  const out = new Uint8Array(width * height * 4);
  const sx = src.width / width;
  const sy = src.height / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.min(src.height - 1, (y + 0.5) * sy - 0.5);
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const wy = Math.max(0, fy - y0);
    for (let x = 0; x < width; x++) {
      const fx = Math.min(src.width - 1, (x + 0.5) * sx - 0.5);
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const wx = Math.max(0, fx - x0);
      for (let c = 0; c < 4; c++) {
        const p = (yy: number, xx: number) => src.data[(yy * src.width + xx) * 4 + c];
        const top = p(y0, x0) * (1 - wx) + p(y0, x1) * wx;
        const bottom = p(y1, x0) * (1 - wx) + p(y1, x1) * wx;
        out[(y * width + x) * 4 + c] = Math.round(top * (1 - wy) + bottom * wy);
      }
    }
  }
  return { width, height, data: out };
}

/**
 * GIF em loop com as fotos do banco público (início → fim do movimento), 480 px de largura.
 * Recebe o id do exercício no banco (ex.: "Barbell_Bench_Press_-_Medium_Grip").
 */
export async function buildPublicDbGif(datasetId: string, width = 480, delayMs = 900): Promise<Uint8Array> {
  if (!/^[\w.-]+$/.test(datasetId)) throw new Error("exercício do banco público inválido");
  const raw = await Promise.all([0, 1].map((i) => download(`${PUBLIC_DB.imageBase}${datasetId}/${i}.jpg`)));
  const decoded = raw.map((b) => jpeg.decode(b, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 }));
  const height = Math.round((decoded[0].height / decoded[0].width) * width);
  const frames = decoded.map((d) => resize({ width: d.width, height: d.height, data: d.data }, width, height));
  // Uma paleta para os dois quadros (evita "piscar" de cores entre eles).
  const all = new Uint8Array(frames.reduce((n, f) => n + f.data.length, 0));
  frames.reduce((off, f) => (all.set(f.data, off), off + f.data.length), 0);
  const palette = quantize(all, 256);
  const gif = GIFEncoder();
  for (const f of frames) gif.writeFrame(applyPalette(f.data, palette), width, height, { palette, delay: delayMs, repeat: 0 });
  gif.finish();
  return gif.bytes();
}

// ─── Vídeo com IA (Veo, pela API do Gemini) ─────────────────────

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
/** Modelos tentados em ordem (o primeiro disponível para a chave). VEO_MODEL tem prioridade. */
const VEO_MODELS = () =>
  [process.env.VEO_MODEL, "veo-3.1-fast-generate-preview", "veo-3.0-fast-generate-001", "veo-2.0-generate-001"].filter(
    (m, i, l): m is string => !!m && l.indexOf(m) === i,
  );

const key = () => {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY não configurada na Vercel");
  return k;
};

/** Mensagem curta do erro da API do Google (sem expor a chave). */
async function apiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; status?: string } } | null;
  const msg = body?.error?.message ?? `HTTP ${res.status}`;
  if (res.status === 429) return "limite de uso da IA atingido; tente mais tarde";
  if (/billing|paid|quota/i.test(msg)) return `a chave do Gemini precisa de faturamento ativo para gerar vídeo (${msg.slice(0, 160)})`;
  return msg.slice(0, 300);
}

/**
 * Começa a gerar o vídeo a partir da foto (JPEG em base64) e do texto. Retorna o nome da
 * operação para acompanhar depois (a geração leva de 1 a 3 minutos).
 */
export async function startVeo(imageBase64: string, prompt: string): Promise<{ operation: string; model: string }> {
  let last = "nenhum modelo de vídeo disponível para esta chave";
  for (const model of VEO_MODELS()) {
    const res = await fetch(`${GEMINI}/models/${encodeURIComponent(model)}:predictLongRunning`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key() },
      body: JSON.stringify({ instances: [{ prompt, image: { bytesBase64Encoded: imageBase64, mimeType: "image/jpeg" } }] }),
    });
    if (res.ok) {
      const body = (await res.json()) as { name?: string };
      if (!body.name) throw new Error("a IA não devolveu a operação");
      return { operation: body.name, model };
    }
    last = await apiError(res);
    // Modelo inexistente para a chave: tenta o próximo; outros erros param aqui.
    if (res.status !== 404 && !/not found|not supported/i.test(last)) break;
  }
  throw new Error(last);
}

export type VeoStatus = { done: false } | { done: true; videoUri: string } | { done: true; error: string };

/** Consulta a operação; quando termina, devolve o link do vídeo (ou o motivo da falha). */
export async function checkVeo(operation: string): Promise<VeoStatus> {
  if (!/^[\w./-]+$/.test(operation)) return { done: true, error: "operação inválida" };
  const res = await fetch(`${GEMINI}/${operation}`, { headers: { "x-goog-api-key": key() }, cache: "no-store" });
  if (!res.ok) return { done: true, error: await apiError(res) };
  const op = (await res.json()) as {
    done?: boolean;
    error?: { message?: string };
    response?: {
      generateVideoResponse?: {
        generatedSamples?: { video?: { uri?: string } }[];
        raiMediaFilteredReasons?: string[];
      };
    };
  };
  if (!op.done) return { done: false };
  if (op.error) return { done: true, error: (op.error.message ?? "falha na geração").slice(0, 300) };
  const r = op.response?.generateVideoResponse;
  const uri = r?.generatedSamples?.[0]?.video?.uri;
  if (uri) return { done: true, videoUri: uri };
  return { done: true, error: r?.raiMediaFilteredReasons?.join("; ").slice(0, 300) || "a IA não gerou o vídeo (filtro de conteúdo)" };
}

/** Baixa o MP4 gerado (o link do Google exige a chave). */
export const downloadVeo = (uri: string) => download(uri, { "x-goog-api-key": key() }, 60_000);
