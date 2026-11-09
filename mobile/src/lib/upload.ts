import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export type Picked = { uri: string; mime: string; ext: string; name: string };

/** Foto da câmera ou da galeria, já reduzida (como o compressImage do site). */
export async function pickPhoto(source: "camera" | "galeria", maxSide = 1600, quality = 0.85, opts: { square?: boolean; png?: boolean } = {}): Promise<Picked | null> {
  const perm = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(source === "camera" ? "Permita o uso da câmera nas configurações do celular." : "Permita o acesso às fotos nas configurações do celular.");
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: !!opts.square, aspect: opts.square ? [1, 1] : undefined };
  const r = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const big = Math.max(a.width, a.height);
  const resize = big > maxSide ? [{ resize: a.width >= a.height ? { width: maxSide } : { height: maxSide } }] : [];
  if (opts.png) {
    const out = await manipulateAsync(a.uri, resize, { format: SaveFormat.PNG });
    return { uri: out.uri, mime: "image/png", ext: "png", name: `logo-${Date.now()}.png` };
  }
  const out = await manipulateAsync(a.uri, resize, { compress: quality, format: SaveFormat.JPEG });
  return { uri: out.uri, mime: "image/jpeg", ext: "jpg", name: `foto-${Date.now()}.jpg` };
}

/** PDF ou imagem de arquivo. */
export async function pickDocument(): Promise<Picked | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const mime = a.mimeType ?? (a.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  if (mime.startsWith("image/")) {
    const out = await manipulateAsync(a.uri, [{ resize: { width: 1800 } }], { compress: 0.85, format: SaveFormat.JPEG });
    return { uri: out.uri, mime: "image/jpeg", ext: "jpg", name: a.name.replace(/\.\w+$/, ".jpg") };
  }
  return { uri: a.uri, mime, ext: "pdf", name: a.name };
}

export async function readBytes(uri: string): Promise<ArrayBuffer> {
  return (await fetch(uri)).arrayBuffer();
}

export async function readBase64(uri: string): Promise<string> {
  const { File } = await import("expo-file-system");
  return new File(uri).base64();
}

export const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

/** Foto remota → JPEG base64 (até `maxSide`), para a IA (que não aceita WebP). */
export async function remoteToJpegBase64(url: string, maxSide = 1024): Promise<string> {
  const { Directory, File, Paths } = await import("expo-file-system");
  const dir = new Directory(Paths.cache, "ia");
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `ref-${Date.now()}`);
  const file = await File.downloadFileAsync(url, dest, { idempotent: true });
  const info = await manipulateAsync(file.uri, []);
  const scale = Math.min(1, maxSide / Math.max(info.width, info.height));
  const out = await manipulateAsync(file.uri, scale < 1 ? [{ resize: { width: Math.round(info.width * scale) } }] : [], { compress: 0.88, format: SaveFormat.JPEG, base64: true });
  return out.base64!;
}

/** Imagem da IA (data URL) → JPEG 1024×764 recortado como o catálogo. */
export async function dataUrlToCatalogJpeg(dataUrl: string): Promise<string> {
  const { File, Paths } = await import("expo-file-system");
  const ext = dataUrl.startsWith("data:image/png") ? "png" : dataUrl.startsWith("data:image/webp") ? "webp" : "jpg";
  const f = new File(Paths.cache, `ia-${Date.now()}.${ext}`);
  f.write(dataUrl.slice(dataUrl.indexOf(",") + 1), { encoding: "base64" });
  const info = await manipulateAsync(f.uri, []);
  const W = 1024;
  const H = 764;
  const scale = Math.max(W / info.width, H / info.height);
  const w = Math.round(info.width * scale);
  const h = Math.round(info.height * scale);
  const out = await manipulateAsync(f.uri, [{ resize: { width: w, height: h } }, { crop: { originX: Math.max(0, Math.round((w - W) / 2)), originY: Math.max(0, Math.round((h - H) / 2)), width: Math.min(W, w), height: Math.min(H, h) } }], { compress: 0.9, format: SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${out.base64}`;
}
