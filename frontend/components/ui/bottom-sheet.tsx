"use client";

export function BottomSheet({ open, children, onClose }: { open: boolean; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-5 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
        {children}
      </div>
    </div>
  );
}

