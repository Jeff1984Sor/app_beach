"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

export default function AlunosPage() {
  const [detalhes, setDetalhes] = useState(false);

  return (
    <main className="space-y-4">
      <Section title="Cadastro de Aluno" subtitle="Simples por padrão, completo sob demanda">
        <Card className="space-y-3">
          <Input placeholder="Nome completo" />
          <Input placeholder="Telefone" />
          <Input placeholder="Plano" />
          <button onClick={() => setDetalhes((v) => !v)} className="text-sm font-medium text-primary">
            {detalhes ? "Ocultar detalhes" : "Ver mais detalhes"}
          </button>
          {detalhes && (
            <div className="space-y-3 rounded-2xl bg-bg p-3">
              <Input placeholder="CPF" />
              <Input placeholder="CEP" />
              <Input placeholder="Endereço" />
              <Input placeholder="Observações" />
            </div>
          )}
          <Button className="w-full">Salvar aluno</Button>
        </Card>
      </Section>
    </main>
  );
}

