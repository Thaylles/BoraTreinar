"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, X } from "lucide-react";
import { inputClass } from "@/components/ui/field";
import { cityName, searchCities, CITY_STATE } from "@/lib/cities";

/** Filtro de cidade da busca de Personais (vai para `?cidade=<código IBGE>`). */
export function CityFilter({ current, basePath }: { current: number | null; basePath: string }) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const options = searchCities(query);
  const go = (code: number | null) => {
    setQuery("");
    router.push(code ? `${basePath}?cidade=${code}` : basePath);
  };

  if (current && cityName(current)) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
        <MapPin className="size-5 text-bandeira-600" aria-hidden />
        <span className="flex-1">
          Personais que atendem em <strong>{cityName(current)}</strong>
        </span>
        <button type="button" onClick={() => go(null)} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
          <X className="size-4" aria-hidden /> Trocar
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <label htmlFor="cidade-busca" className="mb-1.5 block text-sm font-semibold">
        Em qual cidade você treina?
      </label>
      <input
        id="cidade-busca"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && options[0]) {
            e.preventDefault();
            go(options[0].code);
          }
        }}
        placeholder={`Digite sua cidade (${CITY_STATE})…`}
        autoComplete="off"
        className={inputClass}
      />
      {query && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-border bg-surface p-1 shadow-lg" role="listbox">
          {options.length ? (
            options.map((c) => (
              <li key={c.code} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => go(c.code)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-bandeira-50 dark:hover:bg-bandeira-500/15"
                >
                  <MapPin className="size-4 text-muted" aria-hidden /> {c.name}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-muted">Nenhuma cidade do {CITY_STATE} com esse nome.</li>
          )}
        </ul>
      )}
    </div>
  );
}
