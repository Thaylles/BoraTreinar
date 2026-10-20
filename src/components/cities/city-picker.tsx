"use client";

import { useId, useState } from "react";
import { MapPin, X } from "lucide-react";
import { inputClass } from "@/components/ui/field";
import { cityName, searchCities, CITY_STATE } from "@/lib/cities";

/**
 * Seleção de várias cidades com busca (sem acento). Envia cada código IBGE como `name`
 * (campos ocultos), para usar dentro de um formulário.
 */
export function CityPicker({ name, initial }: { name: string; initial: number[] }) {
  const [selected, setSelected] = useState<number[]>(initial);
  const [query, setQuery] = useState("");
  const listId = useId();
  const options = searchCities(query).filter((c) => !selected.includes(c.code));

  const add = (code: number) => {
    setSelected((s) => (s.includes(code) ? s : [...s, code]));
    setQuery("");
  };

  return (
    <div className="space-y-2">
      {selected.map((code) => (
        <input key={code} type="hidden" name={name} value={code} />
      ))}
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Cidades escolhidas">
          {selected.map((code) => (
            <li key={code} className="flex items-center gap-1 rounded-full bg-bandeira-50 py-1 pl-3 pr-1 text-sm font-semibold dark:bg-bandeira-500/15">
              <MapPin className="size-3.5 text-bandeira-600" aria-hidden />
              {cityName(code)}
              <button
                type="button"
                onClick={() => setSelected((s) => s.filter((x) => x !== code))}
                className="rounded-full p-1 text-muted hover:bg-border/60 hover:text-foreground"
                aria-label={`Tirar ${cityName(code)}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhuma cidade escolhida ainda.</p>
      )}
      <div className="relative">
        <label htmlFor={listId} className="sr-only">
          Buscar cidade
        </label>
        <input
          id={listId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (options[0]) add(options[0].code);
            }
          }}
          placeholder={`Digite o nome da cidade (${CITY_STATE})…`}
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
                    onClick={() => add(c.code)}
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
    </div>
  );
}
