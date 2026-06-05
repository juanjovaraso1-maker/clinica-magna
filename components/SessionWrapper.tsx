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
        <div className="min-h-screen bg-[#F4F6FA]">
          <Sidebar />
          <div className="pt-[52px] min-h-screen">
            <main className="p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
      )}
    </SessionProvider>
  );
}
