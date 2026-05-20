"use client";
import { useSession } from "next-auth/react";

export function useRole(): string {
  const { data: session } = useSession();
  return (session?.user as any)?.role ?? "DENTIST";
}

export function useIsAdmin(): boolean {
  return useRole() === "ADMIN";
}
