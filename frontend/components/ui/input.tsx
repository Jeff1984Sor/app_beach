import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none focus:border-primary", className)} {...props} />;
}

