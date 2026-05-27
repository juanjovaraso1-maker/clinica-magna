"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) {
      document.addEventListener("keydown", handler);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-white rounded-t-2xl sm:rounded-[14px] w-full ${sizes[size]} flex flex-col max-h-[92vh] sm:max-h-[90vh] border border-[#E3E8F0]`}
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)" }}
      >
        {/* Drag handle on mobile */}
        <div className="sm:hidden w-10 h-1 bg-[#E3E8F0] rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E3E8F0] flex-shrink-0">
          <h2 className="text-[14px] font-semibold text-[#1A1D2E] tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-full text-[#9AA0B4] hover:text-[#1A1D2E] hover:bg-[#F0F2F7] transition-all"
          >
            <X size={15} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
