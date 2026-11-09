import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Cores e tamanhos do tema (text-foreground × text-bandeira-600, text-base × text-3xl): a última vence.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "text-color": [{ text: ["background", "surface", "foreground", "muted", "border", "bandeira", "ipe", "anil", "pitanga"].map((c) => (v: string) => v === c || v.startsWith(`${c}-`) || v.startsWith(`${c}/`)) }],
    },
  },
});

export const cx = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
