import { useColorScheme } from "react-native";

/** Cores para o que não aceita className (ícones, barras de navegação, gráficos). */
export const palette = {
  bandeira500: "#009c3b",
  bandeira600: "#008633",
  bandeira700: "#006b29",
  bandeira100: "#c2ead1",
  ipe100: "#fff3cc",
  ipe400: "#ffd45c",
  ipe500: "#ffc72c",
  ipe600: "#e6a800",
  anil500: "#1a3f99",
  anil700: "#002776",
  anil900: "#001647",
  pitanga500: "#ff5a36",
  pitanga600: "#e5441f",
  white: "#ffffff",
};

export function useTheme() {
  const dark = useColorScheme() === "dark";
  return {
    dark,
    background: dark ? "#0b1424" : "#fff8e7",
    surface: dark ? "#13203a" : "#ffffff",
    foreground: dark ? "#f4f1e8" : "#10213f",
    muted: dark ? "#a5adbd" : "#5b6577",
    border: dark ? "#22324f" : "#eadfc4",
    ...palette,
  };
}
