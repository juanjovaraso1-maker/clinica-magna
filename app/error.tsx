"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console; in production this would go to Sentry/DataDog
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Algo salió mal</h1>
        <p className="text-slate-500 text-sm mb-6">
          Ocurrió un error inesperado. Tus datos están seguros. Por favor intenta
          nuevamente o recarga la página.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 mb-4 font-mono bg-slate-50 px-3 py-2 rounded">
            Código: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <RefreshCw size={15} /> Reintentar
          </button>
          <a
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <Home size={15} /> Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
