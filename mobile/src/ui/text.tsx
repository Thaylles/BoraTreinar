import { Text as RNText, type TextProps } from "react-native";
import { cx as cn } from "./cn";

/**
 * Texto com as fontes do site: Inter no corpo e Baloo 2 nos títulos ("font-display").
 * No Android cada peso é um arquivo de fonte, então o peso das classes vira o nome da família.
 */
const INTER: Record<string, string> = {
  normal: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};
const BALOO: Record<string, string> = {
  normal: "Baloo2_600SemiBold",
  medium: "Baloo2_600SemiBold",
  semibold: "Baloo2_600SemiBold",
  bold: "Baloo2_700Bold",
  extrabold: "Baloo2_800ExtraBold",
};

export function fontFor(className = "") {
  const weight = /\bfont-(extrabold|bold|semibold|medium)\b/.exec(className)?.[1] ?? (className.includes("font-display") ? "bold" : "normal");
  return (className.includes("font-display") ? BALOO : INTER)[weight];
}

export function Text({ className, style, ...props }: TextProps & { className?: string }) {
  return (
    <RNText
      className={cn("text-base text-foreground", className)}
      style={[{ fontFamily: fontFor(className), fontWeight: "normal" }, style]}
      {...props}
    />
  );
}
