import { cn } from "@/lib/cn";

export function SegmentedControl({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-2xl bg-white p-1 shadow-soft">
      {options.map((opt) => (
        <button key={opt} onClick={() => onChange(opt)} className={cn("rounded-xl px-4 py-2 text-sm", value === opt ? "bg-primary text-white" : "text-muted")}>
          {opt}
        </button>
      ))}
    </div>
  );
}

