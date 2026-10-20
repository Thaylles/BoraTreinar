/** Imagem pronta para desenhar no canvas, com uma função para liberar a memória depois. */
type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

/**
 * Abre a imagem no navegador. Primeiro tenta `createImageBitmap`; se falhar (ex.: foto HEIC do
 * iPhone no Safari, ou foto muito grande), tenta pelo elemento <img>, que o Safari decodifica.
 */
async function decode(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  }
}

/** Foto HEIC/HEIF (padrão do iPhone): só alguns navegadores conseguem abrir. */
export const isHeic = (file: File) => /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

/** Mensagem amigável quando a foto não pôde ser aberta. */
export const imageReadError = (file: File) =>
  isHeic(file)
    ? "Este navegador não abre fotos HEIC do iPhone. Tente pelo Safari, ou no iPhone vá em Ajustes → Câmera → Formatos → Mais Compatível."
    : "Não foi possível ler a imagem. Tente outra foto (JPG ou PNG).";

/**
 * Redimensiona e comprime uma imagem no navegador antes do upload.
 * Saída: WebP (ou JPEG se o navegador não suportar), lado maior ≤ maxSize.
 */
export async function compressImage(file: File, maxSize = 1024, quality = 0.8): Promise<Blob> {
  const img = await decode(file);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    img.release();
    throw new Error("Canvas indisponível");
  }
  ctx.drawImage(img.source, 0, 0, w, h);
  img.release();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  // JPEG não tem transparência: fundo branco (senão logos PNG ficam com fundo preto).
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("Não foi possível processar a imagem");
  return jpeg;
}
