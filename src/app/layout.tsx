import type { Metadata, Viewport } from "next";
import { Baloo_2, Inter } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/pwa/sw-register";
import { ConnectionStatus } from "@/components/pwa/connection-status";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

/** Tamanhos de tela do iPhone (largura, altura em pontos, densidade) com imagem em /public/splash. */
const SPLASH: [number, number, number][] = [
  [440, 956, 3], [430, 932, 3], [428, 926, 3], [402, 874, 3], [393, 852, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2],
];

export const metadata: Metadata = {
  title: {
    default: "BoraTreinar — bora treinar?",
    template: "%s · BoraTreinar",
  },
  description:
    "Registro e acompanhamento de treinos de academia para Personal e Aluno.",
  applicationName: "BoraTreinar",
  appleWebApp: {
    capable: true,
    title: "BoraTreinar",
    statusBarStyle: "default",
    // Tela de abertura do app instalado no iPhone (sem ela o iOS mostra uma tela branca)
    startupImage: SPLASH.map(([w, h, r]) => ({
      url: `/splash/${w * r}x${h * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#009C3B" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1424" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${baloo.variable} antialiased`}>
        <ConnectionStatus />
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
