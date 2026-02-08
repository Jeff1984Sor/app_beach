"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";

export default function AlunoFichaPage() {
  const [tab, setTab] = useState("Aulas");
  return (
    <main className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Ana Costa</h1>
            <p className="text-sm text-muted">Plano Intermediário</p>
          </div>
          <Badge tone="success">Ativo</Badge>
        </div>
      </Card>
      <Tabs tabs={["Aulas", "Financeiro", "WhatsApp", "Contrato", "Anexos"]} active={tab} onChange={setTab} />
      <Section title={tab}>
        <Card>
          <p className="text-sm text-muted">Conteúdo em cards elegantes para {tab.toLowerCase()}.</p>
        </Card>
      </Section>
    </main>
  );
}

