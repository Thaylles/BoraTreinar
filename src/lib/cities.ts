/** Cidades de atendimento (por enquanto só RS): nome pelo código IBGE e busca sem acento. */
import { RS_CITIES } from "./cities-rs.ts";

export const CITY_STATE = "RS";
const NAMES = new Map<number, string>(RS_CITIES);

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const FOLDED = RS_CITIES.map(([code, name]) => ({ code, name, key: fold(name) }));

export const cityName = (code: number) => NAMES.get(code) ?? null;
export const isCity = (code: number) => NAMES.has(code);

/** Cidades que combinam com o texto ("caxias", "sao leo"…): primeiro as que começam com ele. */
export function searchCities(query: string, limit = 8): { code: number; name: string }[] {
  const q = fold(query);
  if (!q) return [];
  const starts = FOLDED.filter((c) => c.key.startsWith(q));
  const contains = FOLDED.filter((c) => !c.key.startsWith(q) && c.key.includes(q));
  return [...starts, ...contains].slice(0, limit).map(({ code, name }) => ({ code, name }));
}

/** "Porto Alegre, Canoas e mais 3" para listas curtas. */
export function citiesLabel(codes: number[], max = 3): string {
  const names = codes.map(cityName).filter((n): n is string => !!n);
  if (names.length <= max) return names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : (names[0] ?? "");
  return `${names.slice(0, max).join(", ")} e mais ${names.length - max}`;
}
