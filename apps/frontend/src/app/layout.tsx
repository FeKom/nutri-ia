import type { Metadata } from "next";
import { DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { JwtProvider } from "@/lib/jwt-context";

const serif = DM_Serif_Display({
  weight: "400",
  variable: "--font-serif",
  subsets: ["latin"],
});

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "nutri.a - Assistente de Nutricao",
  description: "Seu assistente inteligente de nutricao e bem-estar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${serif.variable} ${sans.variable} font-sans antialiased`}
      >
        <JwtProvider>{children}</JwtProvider>
      </body>
    </html>
  );
}
