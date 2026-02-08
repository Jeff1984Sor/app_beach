"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const items = [
  { href: "/home", label: "Home" },
  { href: "/usuarios", label: "Usuarios" },
  { href: "/agenda", label: "Agenda" },
  { href: "/financeiro", label: "Financeiro" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-4 pb-24">
      {children}
      <nav className="fixed bottom-4 left-1/2 flex w-[92%] max-w-lg -translate-x-1/2 justify-around rounded-2xl bg-white p-2 shadow-soft">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={cn("rounded-xl px-4 py-2 text-sm", pathname === i.href ? "bg-primary text-white" : "text-muted")}>
            {i.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

