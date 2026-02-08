"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { useAuthStore } from "@/store/auth";

type Kpi = { label: string; value: string };

const mapRole: Record<string, Kpi[]> = {
  gestor: [
    { label: "Aulas Hoje", value: "18" },
    { label: "Receita Hoje", value: "R$ 4.820" },
    { label: "A Receber", value: "R$ 28.400" },
    { label: "Alunos Ativos", value: "146" },
  ],
  professor: [
    { label: "Aulas Hoje", value: "6" },
    { label: "Proxima Aula", value: "10:30" },
    { label: "Comissao do Mes", value: "R$ 2.140" },
  ],
  aluno: [
    { label: "Proxima Aula", value: "19:00" },
    { label: "Aulas da Semana", value: "3" },
    { label: "Pendencias", value: "R$ 380" },
  ]
};

const tabelas = [
  { nome: "Usuarios", href: "/usuarios" },
  { nome: "Profissionais", href: "/home" },
  { nome: "Alunos", href: "/alunos" },
  { nome: "Unidades", href: "/home" },
  { nome: "Agenda", href: "/agenda" },
  { nome: "Aulas", href: "/agenda" },
  { nome: "Contas Receber", href: "/financeiro" },
  { nome: "Contas Pagar", href: "/financeiro" },
  { nome: "Movimentos Bancarios", href: "/financeiro" },
  { nome: "Regras Comissao", href: "/financeiro" },
  { nome: "Media Files", href: "/home" },
  { nome: "Empresa Config", href: "/home" }
];

export default function HomePage() {
  const role = useAuthStore((s) => s.role) || "gestor";
  const nome = useAuthStore((s) => s.nome) || "Visitante";
  const kpis = useMemo(() => mapRole[role], [role]);

  return (
    <main className="space-y-5">
      <header className="flex items-center justify-between">
        <p className="text-sm text-muted">Painel limpo</p>
        <details className="relative">
          <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-border bg-white text-muted shadow-soft">
            <Settings size={16} />
          </summary>
          <div className="absolute right-0 z-20 mt-2 max-h-80 w-56 overflow-auto rounded-2xl border border-border bg-white p-2 shadow-soft">
            {tabelas.map((item) => (
              <Link key={item.nome} href={item.href} className="block rounded-xl px-3 py-2 text-sm text-text hover:bg-bg">
                {item.nome}
              </Link>
            ))}
          </div>
        </details>
      </header>

      <Section title={`Ola, ${nome}`} subtitle={`Perfil ${role}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {kpis.map((k) => (
            <Card key={k.label} className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{k.label}</p>
              <p className="mt-2 text-3xl font-semibold">{k.value}</p>
            </Card>
          ))}
        </div>
      </Section>

      <div>
        <Link href="/alunos" className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft">
          + Aluno
        </Link>
      </div>
    </main>
  );
}
