import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fundación Rugimos 🐾",
  description: "Programa de esterilización y rescate animal en Santa Cruz",

  openGraph: {
    title: "Fundación Rugimos 🐾",
    description: "Ayudamos a esterilizar y salvar vidas animales",
    url: "https://fundacion-rugimos.vercel.app",
    siteName: "Fundación Rugimos",
    images: [
      {
        url: "https://fundacion-rugimos.vercel.app/logo.png", // troca se quiser
        width: 1200,
        height: 630,
      },
    ],
    locale: "es_BO",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Fundación Rugimos 🐾",
    description: "Rugimos por los que no tienen voz",
    images: ["https://fundacion-rugimos.vercel.app/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
