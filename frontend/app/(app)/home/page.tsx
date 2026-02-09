"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, CreditCard, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { useAuthStore } from "@/store/auth";

type Kpi = { label: string; value: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function iconFor(label: string) {
  const s = String(label || "").toLowerCase();
  if (s.includes("alunos")) return Users;
  if (s.includes("aulas")) return CalendarDays;
  if (s.includes("receb")) return TrendingUp;
  if (s.includes("receita") || s.includes("receber")) return CreditCard;
  return ArrowRight;
}

export default function HomePage() {
  const role = useAuthStore((s) => s.role) || "gestor";
  const nome = useAuthStore((s) => s.nome) || "Visitante";
  const token = useAuthStore((s) => s.token);

  const { data, isLoading } = useQuery<{ kpis: Kpi[] }>({
    queryKey: ["home-kpis", role],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/home/kpis`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      if (!res.ok) return { kpis: [] };
      return res.json();
    },
    enabled: !!token,
  });

  const kpis = data?.kpis || [];

  return (
    <main className="space-y-5">
      <header className="flex items-center justify-between">
        <p className="text-sm text-muted">Painel</p>
      </header>

      <Section title={`Ola, ${nome}`} subtitle={role === "gestor" ? "Visao do gestor" : `Perfil ${role}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-24 animate-pulse" />)}
          {!isLoading &&
            kpis.map((k) => {
              const Icon = iconFor(k.label);
              return (
                <Card key={k.label} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted">{k.label}</p>
                      <p className="mt-2 text-3xl font-semibold text-text">{k.value}</p>
                    </div>
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                      <Icon size={18} />
                    </div>
                  </div>
                </Card>
              );
            })}
          {!isLoading && kpis.length === 0 && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Resumo</p>
              <p className="mt-2 text-sm text-muted">Sem dados ainda para este perfil.</p>
            </Card>
          )}
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/alunos/novo" className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-semibold text-white shadow-soft">
          + Aluno
        </Link>
        <Link href="/financeiro" className="inline-flex h-11 items-center rounded-2xl border border-border bg-white px-5 text-sm font-semibold text-text">
          Ver Financeiro <ArrowRight className="ml-2" size={16} />
        </Link>
      </div>
    </main>
  );
}
