"use client";
import { useEffect, useRef, useCallback } from "react";

const AUTOSAVE_INTERVAL = 30_000; // 30 seconds

/**
 * Autosaves `data` to localStorage every 30 s while `enabled` is true.
 * Call `clear()` after a successful server save to remove the draft.
 */
export function useAutosave<T>(key: string, data: T, enabled: boolean) {
  const dataRef = useRef(data);
  dataRef.current = data;

  const save = useCallback(() => {
    if (!enabled) return;
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), data: dataRef.current }));
    } catch {
      // localStorage might be full — fail silently
    }
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(save, AUTOSAVE_INTERVAL);
    return () => clearInterval(id);
  }, [save, enabled]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }, [key]);

  const restore = useCallback((): { savedAt: string; data: T } | null => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [key]);

  return { save, clear, restore };
}
