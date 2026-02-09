"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/home", label: "Home" },
  { href: "/agenda", label: "Agenda" },
  { href: "/financeiro", label: "Financeiro" },
];

const tabelas = [
  { nome: "Alunos", href: "/alunos" },
  { nome: "Agenda", href: "/agenda" },
  { nome: "Categoria", href: "/configuracoes?entidade=categoria" },
  { nome: "Conta Bancaria", href: "/configuracoes?entidade=conta_bancaria" },
  { nome: "Contas Pagar", href: "/configuracoes?entidade=contas_pagar" },
  { nome: "Contas Receber", href: "/configuracoes?entidade=contas_receber" },
  { nome: "Media Files", href: "/configuracoes?entidade=media_files" },
  { nome: "Modelo de Contrato", href: "/configuracoes?entidade=modelo_contrato" },
  { nome: "Movimentacoes Financeiras", href: "/configuracoes?entidade=movimentacoes_financeiras" },
  { nome: "Plano", href: "/configuracoes?entidade=plano" },
  { nome: "Regras Comissao", href: "/configuracoes?entidade=regras_comissao" },
  { nome: "Subcategoria", href: "/configuracoes?entidade=subcategoria" },
  { nome: "Unidades", href: "/configuracoes?entidade=unidades" },
  { nome: "Usuarios", href: "/usuarios" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-4 pb-24 pt-16">
      <div className="pointer-events-none fixed left-1/2 top-4 z-40 flex w-[92%] max-w-5xl -translate-x-1/2 justify-end">
        <details ref={menuRef} className="pointer-events-auto relative">
          <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-border bg-white text-muted shadow-soft">
            <Settings size={16} />
          </summary>
          <div className="absolute right-0 z-20 mt-2 max-h-80 w-56 overflow-auto rounded-2xl border border-border bg-white p-2 shadow-soft">
            {tabelas.map((item) => (
              <Link
                key={item.nome}
                href={item.href}
                onClick={() => {
                  if (menuRef.current) menuRef.current.open = false;
                }}
                className="block rounded-xl px-3 py-2 text-sm text-text hover:bg-bg"
              >
                {item.nome}
              </Link>
            ))}
          </div>
        </details>
      </div>

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
