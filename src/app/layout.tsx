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

export const metadata: Metadata = {
  title: {
    default: "BoraTreinar — bora treinar?",
    template: "%s · BoraTreinar",
  },
  description:
    "Registro e acompanhamento de treinos de academia para Personal e Aluno.",
  applicationName: "BoraTreinar",
  appleWebApp: { capable: true, title: "BoraTreinar", statusBarStyle: "default" },
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
