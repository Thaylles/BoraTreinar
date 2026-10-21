/** GIF (img) ou vídeo curto em loop, sem som. */
export function MediaPreview({ url, kind, alt, controls = false }: { url: string; kind: "gif" | "video"; alt: string; controls?: boolean }) {
  return kind === "gif" ? (
    // eslint-disable-next-line @next/next/no-img-element -- GIF animado do bucket público
    <img src={url} alt={alt} loading="lazy" className="w-full rounded-xl bg-white object-contain" />
  ) : (
    <video src={url} aria-label={alt} autoPlay loop muted playsInline controls={controls} preload="metadata" className="w-full rounded-xl bg-black" />
  );
}
