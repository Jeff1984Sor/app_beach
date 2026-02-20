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

type Mov = {
  id: number;
  data_movimento: string;
  data_iso?: string | null;
  tipo: string;
  valor: number;
  descricao: string;
  categoria?: string;
  subcategoria?: string;
  conta_bancaria_id?: number | null;
  conta_nome?: string;
};

type Conta = { id: number; nome_conta: string; banco: string };
type Categoria = { id: number; nome: string; tipo: "Receita" | "Despesa"; status: string };

function toBRL(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeekIso() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function startOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function parseDateToIso(m: Mov) {
  if (m.data_iso) return String(m.data_iso);
  const s = String(m.data_movimento || "");
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

async function fetchMovs() {
  const res = await fetch(`${API_URL}/movimentacoes-financeiras`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

async function fetchDre() {
  const res = await fetch(`${API_URL}/dre`, { cache: "no-store" });
  if (!res.ok) return {};
  return res.json();
}

export default function FinanceiroPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");

  const [contaFiltro, setContaFiltro] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [periodo, setPeriodo] = useState<"semana" | "mes" | "custom">("mes");
  const [dataInicio, setDataInicio] = useState(startOfMonthIso());
  const [dataFim, setDataFim] = useState(isoToday());

  const { data: movimentos = [] } = useQuery<Mov[]>({ queryKey: ["movs-financeiro"], queryFn: fetchMovs });
  const { data: dre } = useQuery({ queryKey: ["dre"], queryFn: fetchDre });
  const { data: contas = [] } = useQuery<Conta[]>({
    queryKey: ["contas-bancarias-financeiro"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/contas-bancarias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["categorias-financeiro"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/categorias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const periodRange = useMemo(() => {
    if (periodo === "semana") return { ini: startOfWeekIso(), fim: isoToday() };
    if (periodo === "mes") return { ini: startOfMonthIso(), fim: isoToday() };
    return { ini: dataInicio, fim: dataFim };
  }, [periodo, dataInicio, dataFim]);

  const filtrados = useMemo(() => {
    return (movimentos || []).filter((m) => {
      const dataIso = parseDateToIso(m);
      if (periodRange.ini && dataIso && dataIso < periodRange.ini) return false;
      if (periodRange.fim && dataIso && dataIso > periodRange.fim) return false;
      if (contaFiltro && String(m.conta_bancaria_id || "") !== contaFiltro) return false;
      if (categoriaFiltro && String(m.categoria || "") !== categoriaFiltro) return false;
      return true;
    });
  }, [movimentos, periodRange, contaFiltro, categoriaFiltro]);

  const resumo = useMemo(() => {
    const receitas = filtrados
      .filter((m) => ["entrada", "receita"].includes(String(m.tipo || "").toLowerCase()))
      .reduce((a, b) => a + Number(b.valor || 0), 0);
    const despesas = filtrados
      .filter((m) => ["saida", "saída", "despesa"].includes(String(m.tipo || "").toLowerCase()))
      .reduce((a, b) => a + Number(b.valor || 0), 0);
    return { receitas, despesas, resultado: receitas - despesas };
  }, [filtrados]);

  async function salvar() {
    await fetch(`${API_URL}/financeiro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, data: isoToday(), valor: Number(valor || 0), descricao }),
    });
    setOpen(false);
    setTipo("entrada");
    setValor("");
    setDescricao("");
    qc.invalidateQueries({ queryKey: ["movs-financeiro"] });
    qc.invalidateQueries({ queryKey: ["dre"] });
  }

  async function apagar(id: number) {
    await fetch(`${API_URL}/financeiro/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["movs-financeiro"] });
    qc.invalidateQueries({ queryKey: ["dre"] });
  }

  function exportarExcel() {
    const header = ["Data", "Tipo", "Conta", "Categoria", "Subcategoria", "Descricao", "Valor"];
    const lines = filtrados.map((m) =>
      [m.data_movimento, m.tipo, m.conta_nome || "", m.categoria || "", m.subcategoria || "", m.descricao || "", String(m.valor || 0)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${isoToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarPDF() {
    window.print();
  }

  return (
    <main className="space-y-4">
      <Section title="Financeiro" subtitle="Resumo e DRE real">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><p className="text-sm text-muted">Receita</p><p className="text-2xl font-semibold">{toBRL(resumo.receitas)}</p></Card>
          <Card><p className="text-sm text-muted">Despesas</p><p className="text-2xl font-semibold">{toBRL(resumo.despesas)}</p></Card>
          <Card><p className="text-sm text-muted">Resultado</p><p className="text-2xl font-semibold text-success">{toBRL(resumo.resultado)}</p></Card>
        </div>
      </Section>

      <Card className="space-y-3 p-4">
        <p className="text-sm font-semibold text-text">Filtros</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <select value={contaFiltro} onChange={(e) => setContaFiltro(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Conta bancaria (todas)</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome_conta} - {c.banco}</option>)}
          </select>
          <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Categoria (todas)</option>
            {categorias.filter((c) => c.status === "ativo").map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as any)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="mes">Mes</option>
            <option value="semana">Semana</option>
            <option value="custom">Dia inicio e dia fim</option>
          </select>
        </div>
        {periodo === "custom" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button onClick={exportarExcel} className="rounded-xl border border-border px-3 py-2 text-sm text-text">Excel</button>
          <button onClick={exportarPDF} className="rounded-xl border border-border px-3 py-2 text-sm text-text">PDF</button>
        </div>
      </Card>

      <Card>
        <p className="mb-3 text-sm text-muted">DRE</p>
        <div className="grid gap-2 text-sm">
          <p>Receita: {toBRL(Number(dre?.receita || 0))}</p>
          <p>Despesas: {toBRL(Number(dre?.despesas || 0))}</p>
          <p>Comissao: {toBRL(Number(dre?.comissao || 0))}</p>
          <p className="font-semibold">Resultado final: {toBRL(Number(dre?.resultado_final || 0))}</p>
        </div>
      </Card>

      <Section title="Lancamentos">
        <div className="space-y-2">
          {filtrados.map((m) => (
            <Card key={m.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{m.descricao || m.tipo}</p>
                <p className="text-sm text-muted">
                  {m.data_movimento} • {m.categoria || "Sem categoria"} / {m.subcategoria || "Sem subcategoria"} • {m.conta_nome || "Sem conta"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text">{toBRL(m.valor)}</p>
                <button onClick={() => apagar(m.id)} className="rounded-xl border border-border px-3 py-2 text-sm text-danger">Apagar</button>
              </div>
            </Card>
          ))}
          {filtrados.length === 0 && <p className="text-sm text-muted">Sem lancamentos no filtro selecionado.</p>}
        </div>
      </Section>

      <FloatingActionButton onClick={() => setOpen(true)} />
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Novo lancamento</h3>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "entrada" | "saida")} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="entrada">Receita</option>
            <option value="saida">Despesa</option>
          </select>
          <Input placeholder="Descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <Input placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Button className="w-full" onClick={salvar}>Salvar</Button>
        </div>
      </BottomSheet>
    </main>
  );
}
