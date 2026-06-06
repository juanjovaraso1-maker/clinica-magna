import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";

export const metadata: Metadata = {
  title: "Clínica Magna",
  description: "Sistema de gestión dental Clínica Magna",
};

export const viewport: Viewport = {
  width: 1200,
  userScalable: true,
  minimumScale: 0.1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-[#F4F6FA]">
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
