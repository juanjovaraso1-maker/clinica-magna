"use client";
import { useEffect, useRef } from "react";

/**
 * Warns the user before closing/navigating away when there are unsaved changes.
 * Pass `isDirty = true` when the form has been modified.
 */
export function useUnsavedChanges(isDirty: boolean, message = "Tienes cambios sin guardar. ¿Seguro que quieres salir?") {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = message;
      return message;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [message]);
}
