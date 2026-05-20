"use client";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";

export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  return (
    <SessionProvider>
      {isAuthPage ? (
        <>{children}</>
      ) : (
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-18 md:pt-6">
              {children}
            </main>
          </div>
        </div>
      )}
    </SessionProvider>
  );
}
