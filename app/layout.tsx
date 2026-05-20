import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Clínica Magna",
  description: "Sistema de gestión dental Clínica Magna",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-18 md:pt-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
