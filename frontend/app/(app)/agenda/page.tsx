"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented-control";

const aulas = [
  { hora: "08:00", nome: "João Lima", unidade: "Unidade Sul", status: "confirmada" },
  { hora: "09:30", nome: "Carla Nunes", unidade: "Unidade Oeste", status: "pendente" },
  { hora: "11:00", nome: "Rafa Gomes", unidade: "Unidade Sul", status: "confirmada" },
];

export default function AgendaPage() {
  const [dia, setDia] = useState("Hoje");
  return (
    <main className="space-y-4">
      <Section title="Agenda" subtitle="Visual diário">
        <SegmentedControl options={["Hoje", "Amanhã", "Semana"]} value={dia} onChange={setDia} />
      </Section>
      <div className="space-y-3">
        {aulas.map((a) => (
          <Card key={`${a.hora}-${a.nome}`} className="flex items-center justify-between">
            <div>
              <p className="text-xl font-semibold text-primary">{a.hora}</p>
              <p className="font-medium">{a.nome}</p>
              <p className="text-sm text-muted">{a.unidade}</p>
            </div>
            <Badge tone={a.status === "confirmada" ? "success" : "default"}>{a.status}</Badge>
          </Card>
        ))}
      </div>
    </main>
  );
}

