/** Esqueleto de carregamento das telas internas (título, cartões e lista). */
export function PageSkeleton() {
  const bar = "rounded-xl bg-border/60 motion-safe:animate-pulse";
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-4">
      <div className={`${bar} h-9 w-2/3`} />
      <div className={`${bar} h-4 w-1/2`} />
      <div className="grid grid-cols-3 gap-3 pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${bar} h-24 rounded-3xl`} />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`${bar} h-16 rounded-2xl`} />
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
