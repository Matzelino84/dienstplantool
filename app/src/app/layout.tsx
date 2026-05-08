import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dienstplantool - Hebammen Schichtplanung",
  description:
    "Intelligente Dienstplanung für Hebammen-Teams. Wunschplan eingeben, automatisch optimieren, fair verteilen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-mesh">{children}</body>
    </html>
  );
}
