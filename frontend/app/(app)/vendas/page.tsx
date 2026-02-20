"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type Produto = { id: number; nome: string; status: string; valor_venda?: number };
type Aluno = { id: number; nome: string };
type ContaBancaria = { id: number; nome_conta: string; banco: string };
type Venda = {
  id: number;
  produto_nome: string;
  comprador_nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  data_venda: string;
  status: string;
};

function toBRL(v: number) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default function VendasPage() {
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<"semana" | "mes" | "personalizado">("mes");
  const [dataInicio, setDataInicio] = useState(defaultWeekStart());
  const [dataFim, setDataFim] = useState(todayIso());

  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");
  const [dataVenda, setDataVenda] = useState(todayIso());
  const [tipoComprador, setTipoComprador] = useState<"aluno" | "outro">("aluno");
  const [alunoId, setAlunoId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [msg, setMsg] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [payVendaId, setPayVendaId] = useState<number | null>(null);
  const [payData, setPayData] = useState(todayIso());
  const [payContaId, setPayContaId] = useState("");

  const vendasQ = useQuery<Venda[]>({
    queryKey: ["vendas", periodo, dataInicio, dataFim],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("periodo", periodo === "personalizado" ? "todos" : periodo);
      if (periodo === "personalizado") {
        qs.set("data_inicio", dataInicio);
        qs.set("data_fim", dataFim);
      }
      const res = await fetch(`${API_URL}/vendas?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const produtosQ = useQuery<Produto[]>({
    queryKey: ["produtos-vendas"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/produtos`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const alunosQ = useQuery<Aluno[]>({
    queryKey: ["alunos-vendas"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/alunos`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const contasQ = useQuery<ContaBancaria[]>({
    queryKey: ["contas-vendas"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/contas-bancarias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const produtosAtivos = useMemo(
    () => (produtosQ.data || []).filter((p) => String(p.status || "").toLowerCase() === "ativo"),
    [produtosQ.data]
  );
  function formatarNumeroComoMoeda(valor: number) {
    return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  useEffect(() => {
    const p = produtosAtivos.find((x) => String(x.id) === String(produtoId));
    if (p && Number(p.valor_venda || 0) > 0) {
      setValorUnitario(formatarNumeroComoMoeda(Number(p.valor_venda || 0)));
    }
  }, [produtoId, produtosAtivos]);
  const totalPeriodo = useMemo(
    () => (vendasQ.data || []).reduce((acc, v) => acc + Number(v.valor_total || 0), 0),
    [vendasQ.data]
  );

  function formatarMoedaInput(raw: string) {
    const digits = String(raw || "").replace(/\D/g, "");
    const cents = Number(digits || "0");
    const valor = cents / 100;
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function parseMoedaInput(raw: string) {
    const clean = String(raw || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  }

  async function salvarVenda() {
    setMsg("");
    const payload: any = {
      produto_id: produtoId ? Number(produtoId) : null,
      quantidade: Number(quantidade || 0),
      valor_unitario: parseMoedaInput(valorUnitario),
      data_venda: dataVenda || todayIso(),
      aluno_id: tipoComprador === "aluno" && alunoId ? Number(alunoId) : null,
      cliente_nome: tipoComprador === "outro" ? clienteNome : null,
    };
    const res = await fetch(`${API_URL}/vendas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMsg(err.detail || "Falha ao salvar venda");
      return;
    }
    setProdutoId("");
    setQuantidade("1");
    setValorUnitario("");
    setDataVenda(todayIso());
    setAlunoId("");
    setClienteNome("");
    qc.invalidateQueries({ queryKey: ["vendas"] });
    qc.invalidateQueries({ queryKey: ["contas-receber-config"] });
  }

  function exportarCSV() {
    const rows = vendasQ.data || [];
    const header = ["Data", "Comprador", "Produto", "Quantidade", "Valor Unitario", "Valor Total", "Status"];
    const lines = rows.map((r) =>
      [r.data_venda, r.comprador_nome, r.produto_nome, String(r.quantidade), String(r.valor_unitario), String(r.valor_total), r.status]
        .map((v) => `"${String(v || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas_${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarPDF() {
    window.print();
  }

  async function confirmarPagamento() {
    if (!payVendaId) return;
    const res = await fetch(`${API_URL}/vendas/${payVendaId}/pagar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data_pagamento: payData,
        conta_bancaria_id: payContaId ? Number(payContaId) : null,
      }),
    });
    if (res.ok) {
      setPayOpen(false);
      setPayVendaId(null);
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes-financeiras-config"] });
      qc.invalidateQueries({ queryKey: ["contas-bancarias-config"] });
    }
  }

  return (
    <main className="space-y-4">
      <Section title="Vendas" subtitle="Controle de venda de produtos e recebimentos">
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="p-4 sm:col-span-3">
            <p className="text-sm text-muted">Total no periodo</p>
            <p className="text-2xl font-semibold text-text">{toBRL(totalPeriodo)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted">Itens</p>
            <p className="text-2xl font-semibold text-text">{(vendasQ.data || []).length}</p>
          </Card>
        </div>
      </Section>

      <Card className="space-y-3 p-4">
        <p className="text-sm font-semibold text-text">Nova venda</p>
        <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
          <option value="">Produto</option>
          {produtosAtivos.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Quantidade" />
          <Input value={valorUnitario} onChange={(e) => setValorUnitario(formatarMoedaInput(e.target.value))} placeholder="R$ 0,00" />
        </div>
        <Input type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTipoComprador("aluno")} className={`rounded-xl px-4 py-2 text-sm ${tipoComprador === "aluno" ? "bg-primary text-white" : "border border-border text-text"}`}>Aluno</button>
          <button type="button" onClick={() => setTipoComprador("outro")} className={`rounded-xl px-4 py-2 text-sm ${tipoComprador === "outro" ? "bg-primary text-white" : "border border-border text-text"}`}>Outra pessoa</button>
        </div>
        {tipoComprador === "aluno" ? (
          <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione o aluno</option>
            {(alunosQ.data || []).map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        ) : (
          <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome da pessoa" />
        )}
        {msg && <p className="text-sm text-danger">{msg}</p>}
        <Button onClick={salvarVenda}>Salvar venda</Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as any)} className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-text">
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
            <option value="personalizado">Personalizado</option>
          </select>
          {periodo === "personalizado" && (
            <>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </>
          )}
          <button onClick={exportarCSV} className="ml-auto rounded-xl border border-border px-3 py-2 text-sm text-text">Excel</button>
          <button onClick={exportarPDF} className="rounded-xl border border-border px-3 py-2 text-sm text-text">PDF</button>
        </div>
        <div className="space-y-2">
          {(vendasQ.data || []).map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-2xl border border-border p-3">
              <div>
                <p className="font-semibold text-text">{v.comprador_nome}</p>
                <p className="text-sm text-muted">{v.produto_nome} • Qtd {v.quantidade} • {v.data_venda}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-text">{toBRL(v.valor_total)}</p>
                {String(v.status || "").toLowerCase() !== "pago" ? (
                  <button
                    onClick={() => {
                      setPayVendaId(v.id);
                      setPayData(todayIso());
                      setPayContaId("");
                      setPayOpen(true);
                    }}
                    className="mt-2 rounded-xl bg-success px-3 py-2 text-xs font-semibold text-white"
                  >
                    Dar baixa
                  </button>
                ) : (
                  <span className="text-xs text-success">Pago</span>
                )}
              </div>
            </div>
          ))}
          {(vendasQ.data || []).length === 0 && <p className="text-sm text-muted">Sem vendas no periodo.</p>}
        </div>
      </Card>

      <Modal open={payOpen} title="Dar baixa na venda" onClose={() => setPayOpen(false)}>
        <div className="space-y-3">
          <Input type="date" value={payData} onChange={(e) => setPayData(e.target.value)} />
          <select value={payContaId} onChange={(e) => setPayContaId(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Conta bancaria (opcional)</option>
            {(contasQ.data || []).map((c) => (
              <option key={c.id} value={c.id}>{c.nome_conta} - {c.banco}</option>
            ))}
          </select>
          <Button onClick={confirmarPagamento}>Confirmar</Button>
        </div>
      </Modal>
    </main>
  );
}
