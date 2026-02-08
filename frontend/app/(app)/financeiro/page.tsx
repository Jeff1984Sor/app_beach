"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Section } from "@/components/ui/section";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function FinanceiroPage() {
  const [open, setOpen] = useState(false);
  return (
    <main className="space-y-4">
      <Section title="Financeiro" subtitle="Resumo e DRE">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><p className="text-sm text-muted">Receita</p><p className="text-2xl font-semibold">R$ 82.140</p></Card>
          <Card><p className="text-sm text-muted">Despesas</p><p className="text-2xl font-semibold">R$ 21.980</p></Card>
          <Card><p className="text-sm text-muted">Resultado</p><p className="text-2xl font-semibold text-success">R$ 60.160</p></Card>
        </div>
      </Section>
      <Card>
        <p className="mb-3 text-sm text-muted">DRE (gráfico simples)</p>
        <div className="flex h-24 items-end gap-2">
          <div className="w-1/3 rounded-t-xl bg-primary" style={{ height: "85%" }} />
          <div className="w-1/3 rounded-t-xl bg-danger" style={{ height: "40%" }} />
          <div className="w-1/3 rounded-t-xl bg-success" style={{ height: "62%" }} />
        </div>
      </Card>
      <FloatingActionButton onClick={() => setOpen(true)} />
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Novo lançamento</h3>
          <Input placeholder="Descrição" />
          <Input placeholder="Valor" />
          <Button className="w-full">Salvar</Button>
        </div>
      </BottomSheet>
    </main>
  );
}

