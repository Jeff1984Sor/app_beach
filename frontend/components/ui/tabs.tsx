"use client";
import { cn } from "@/lib/cn";

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 overflow-auto rounded-2xl bg-white p-1 shadow-soft">
      {tabs.map((tab) => (
        <button key={tab} onClick={() => onChange(tab)} className={cn("rounded-xl px-4 py-2 text-sm", active === tab ? "bg-primary text-white" : "text-muted")}>
          {tab}
        </button>
      ))}
    </div>
  );
}

