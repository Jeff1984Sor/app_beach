"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { useAuthStore } from "@/store/auth";

type Kpi = { label: string; value: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function HomePage() {
  const role = useAuthStore((s) => s.role) || "gestor";
  const nome = useAuthStore((s) => s.nome) || "Visitante";
  const token = useAuthStore((s) => s.token);

  const { data } = useQuery<{ kpis: Kpi[] }>({
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
        <p className="text-sm text-muted">Painel limpo</p>
      </header>

      <Section title={`Ola, ${nome}`} subtitle={`Perfil ${role}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {kpis.map((k) => (
            <Card key={k.label} className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{k.label}</p>
              <p className="mt-2 text-3xl font-semibold">{k.value}</p>
            </Card>
          ))}
          {kpis.length === 0 && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Resumo</p>
              <p className="mt-2 text-sm text-muted">Sem dados ainda para este perfil.</p>
            </Card>
          )}
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

