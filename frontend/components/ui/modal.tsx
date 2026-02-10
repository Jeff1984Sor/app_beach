"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center p-5 sm:items-center">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-soft" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h3 className="text-lg font-semibold text-text">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-white text-muted hover:bg-bg"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-5 py-4 overscroll-contain touch-pan-y">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
