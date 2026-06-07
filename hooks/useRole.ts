"use client";
import { useSession } from "next-auth/react";

export function useRole(): string | undefined {
  const { data: session, status } = useSession();
  if (status === "loading") return undefined;
  return (session?.user as any)?.role ?? "DENTIST";
}

export function useIsAdmin(): boolean | undefined {
  const role = useRole();
  if (role === undefined) return undefined;
  return role === "ADMIN";
}
