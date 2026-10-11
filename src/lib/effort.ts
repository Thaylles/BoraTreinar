/** Escala de esforço percebido do treino (1 a 5). */
export const EFFORT = [
  { value: 1, emoji: "😌", label: "Muito leve" },
  { value: 2, emoji: "🙂", label: "Leve" },
  { value: 3, emoji: "😤", label: "Moderado" },
  { value: 4, emoji: "🥵", label: "Pesado" },
  { value: 5, emoji: "💀", label: "Exaustivo" },
] as const;

export const effortInfo = (v: number | null | undefined) => EFFORT.find((e) => e.value === v);
