import { cn } from "@/lib/cn";

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn("rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition active:scale-[0.98] disabled:opacity-60", className)}
      {...props}
    />
  );
}

