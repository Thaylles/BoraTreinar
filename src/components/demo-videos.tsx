const VIDEOS = [
  { src: "/demo/aluno", poster: "/demo/aluno.jpg", title: "Para alunos", text: "Ficha no celular, carga sugerida, descanso cronometrado e evolução." },
  { src: "/demo/personal", poster: "/demo/personal.jpg", title: "Para personais", text: "Alunos, fichas com técnicas, agenda, avisos e evolução de cada um." },
];

/** Vídeos de demonstração narrados (formato celular). */
export function DemoVideos() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {VIDEOS.map((v) => (
        <figure key={v.src} className="flex flex-col items-center">
          <div className="w-full max-w-[300px] overflow-hidden rounded-[2rem] border-[6px] border-anil-900 bg-anil-900 shadow-xl">
            <video
              poster={v.poster}
              controls
              playsInline
              preload="none"
              className="block aspect-[390/844] w-full bg-background"
              aria-label={`Vídeo de demonstração: ${v.title}`}
            >
              {/* MP4 (H.264) para Safari/Chrome; WebM para navegadores sem H.264. */}
              <source src={`${v.src}.mp4`} type="video/mp4" />
              <source src={`${v.src}.webm`} type="video/webm" />
            </video>
          </div>
          <figcaption className="mt-3 text-center">
            <span className="block font-display text-xl font-bold">{v.title}</span>
            <span className="text-sm text-muted">{v.text}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
