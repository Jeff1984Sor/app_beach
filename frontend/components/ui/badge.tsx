import { cn } from "@/lib/cn";

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "danger" }) {
  const toneClass = tone === "success" ? "bg-success/10 text-success" : tone === "danger" ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary";
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-medium", toneClass)}>{children}</span>;
}

