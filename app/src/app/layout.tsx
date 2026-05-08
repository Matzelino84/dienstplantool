import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dienstplantool - Hebammen Schichtplanung",
  description:
    "Intelligente Dienstplanung fur Hebammen-Teams. Wunschplan eingeben, automatisch optimieren, fair verteilen.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-mesh">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
