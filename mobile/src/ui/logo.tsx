import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { LOGO_SVG_INNER } from "@/components/brand/logo-svg";
import { Text } from "./text";

const xml = (size: number) => `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">${LOGO_SVG_INNER}</svg>`;

/** Losango verde-amarelo com o halter (mesmo desenho do site). */
export function LogoMark({ size = 40 }: { size?: number }) {
  return <SvgXml xml={xml(size)} width={size} height={size} />;
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <View className="flex-row items-center gap-2">
      <LogoMark size={size} />
      <Text className="font-display font-extrabold" style={{ fontSize: size * 0.6, lineHeight: size * 0.75 }}>
        <Text className="font-display font-extrabold text-bandeira-500" style={{ fontSize: size * 0.6 }}>
          Bora
        </Text>
        <Text className="font-display font-extrabold text-anil-700 dark:text-ipe-500" style={{ fontSize: size * 0.6 }}>
          Treinar
        </Text>
      </Text>
    </View>
  );
}
