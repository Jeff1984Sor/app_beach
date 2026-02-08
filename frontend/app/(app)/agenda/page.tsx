"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

async function fetchAgenda() {
  const res = await fetch(`${API_URL}/agenda`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar agenda");
  return res.json();
}

export default function AgendaPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["agenda"], queryFn: fetchAgenda });

  const aulas = useMemo(() => data.map((a: any) => ({
    id: a.id,
    hora: a.inicio ? new Date(a.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--",
    nome: `Aula #${a.id}`,
    unidade: "Unidade Sul",
    status: a.status || "agendada",
  })), [data]);

  return (
    <main className="space-y-4">
      <Section title="Agenda" subtitle="Visual diario em cards">
        <div className="space-y-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-20 animate-pulse" />)}
          {!isLoading && aulas.map((a: any) => (
            <Card key={a.id} className="flex items-center justify-between">
              <div>
                <p className="text-xl font-semibold text-primary">{a.hora}</p>
                <p className="font-medium">{a.nome}</p>
                <p className="text-sm text-muted">{a.unidade}</p>
              </div>
              <Badge tone={a.status === "realizada" || a.status === "confirmada" ? "success" : a.status === "cancelada" ? "danger" : "default"}>{a.status}</Badge>
            </Card>
          ))}
        </div>
      </Section>
    </main>
  );
}
