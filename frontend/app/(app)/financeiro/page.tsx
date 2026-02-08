"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Section } from "@/components/ui/section";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

async function fetchFinanceiro() {
  const res = await fetch(`${API_URL}/financeiro`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar financeiro");
  return res.json();
}

async function fetchDre() {
  const res = await fetch(`${API_URL}/dre`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar DRE");
  return res.json();
}

export default function FinanceiroPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("receita");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: movimentos = [] } = useQuery({ queryKey: ["financeiro"], queryFn: fetchFinanceiro });
  const { data: dre } = useQuery({ queryKey: ["dre"], queryFn: fetchDre });

  const resumo = useMemo(() => {
    const receitas = movimentos.filter((m: any) => m.tipo === "receita").reduce((a: number, b: any) => a + Number(b.valor), 0);
    const despesas = movimentos.filter((m: any) => m.tipo !== "receita").reduce((a: number, b: any) => a + Number(b.valor), 0);
    return { receitas, despesas, resultado: receitas - despesas };
  }, [movimentos]);

  async function salvar() {
    await fetch(`${API_URL}/financeiro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, data: new Date().toISOString().slice(0, 10), valor: Number(valor || 0), descricao }),
    });
    setOpen(false);
    setTipo("receita");
    setValor("");
    setDescricao("");
    qc.invalidateQueries({ queryKey: ["financeiro"] });
    qc.invalidateQueries({ queryKey: ["dre"] });
  }

  async function apagar(id: number) {
    await fetch(`${API_URL}/financeiro/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["financeiro"] });
    qc.invalidateQueries({ queryKey: ["dre"] });
  }

  return (
    <main className="space-y-4">
      <Section title="Financeiro" subtitle="Resumo e DRE real">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><p className="text-sm text-muted">Receita</p><p className="text-2xl font-semibold">R$ {resumo.receitas.toFixed(2)}</p></Card>
          <Card><p className="text-sm text-muted">Despesas</p><p className="text-2xl font-semibold">R$ {resumo.despesas.toFixed(2)}</p></Card>
          <Card><p className="text-sm text-muted">Resultado</p><p className="text-2xl font-semibold text-success">R$ {resumo.resultado.toFixed(2)}</p></Card>
        </div>
      </Section>

      <Card>
        <p className="mb-3 text-sm text-muted">DRE</p>
        <div className="grid gap-2 text-sm">
          <p>Receita: R$ {Number(dre?.receita || 0).toFixed(2)}</p>
          <p>Despesas: R$ {Number(dre?.despesas || 0).toFixed(2)}</p>
          <p>Comissao: R$ {Number(dre?.comissao || 0).toFixed(2)}</p>
          <p className="font-semibold">Resultado final: R$ {Number(dre?.resultado_final || 0).toFixed(2)}</p>
        </div>
      </Card>

      <Section title="Lancamentos">
        <div className="space-y-2">
          {movimentos.map((m: any) => (
            <Card key={m.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{m.tipo}</p>
                <p className="text-sm text-muted">R$ {Number(m.valor).toFixed(2)}</p>
              </div>
              <button onClick={() => apagar(m.id)} className="rounded-xl border border-border px-3 py-2 text-sm text-danger">Apagar</button>
            </Card>
          ))}
        </div>
      </Section>

      <FloatingActionButton onClick={() => setOpen(true)} />
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Novo lancamento</h3>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
          <Input placeholder="Descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <Input placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Button className="w-full" onClick={salvar}>Salvar</Button>
        </div>
      </BottomSheet>
    </main>
  );
}
