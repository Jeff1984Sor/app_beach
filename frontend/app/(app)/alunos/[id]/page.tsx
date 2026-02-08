"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarPlus, MessageCircle, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented-control";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

async function fetchFicha(id: string) {
  const res = await fetch(`${API_URL}/alunos/${id}/ficha`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar ficha");
  return res.json();
}

const tabs = ["Aulas", "Financeiro", "Contratos", "WhatsApp"];

export default function AlunoFichaPage() {
  const params = useParams<{ id: string }>();
  const [tab, setTab] = useState("Aulas");
  const { data, isLoading } = useQuery({ queryKey: ["aluno-ficha", params.id], queryFn: () => fetchFicha(params.id) });

  const resumoFinanceiro = useMemo(() => {
    if (!data) return { aberto: "R$ 0", pago: "R$ 0", proximo: "--" };
    const aberto = data.financeiro.filter((x: any) => x.status === "aberto").reduce((a: number, b: any) => a + Number(b.valor), 0);
    const pago = data.financeiro.filter((x: any) => x.status === "pago").reduce((a: number, b: any) => a + Number(b.valor), 0);
    const prox = data.financeiro.find((x: any) => x.status === "aberto")?.vencimento || "--";
    return { aberto: `R$ ${aberto.toFixed(2)}`, pago: `R$ ${pago.toFixed(2)}`, proximo: prox };
  }, [data]);

  async function visualizarContrato() {
    if (!data) return;
    const res = await fetch(`${API_URL}/alunos/${data.id}/gerar-contrato`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plano_nome: "Plano Mensal", plano_valor: "R$ 380,00", plano_duracao: "Mensal", plano_qtd_aulas_semanais: "3" }),
    });
    const contrato = await res.json();
    alert(contrato.conteudo || "Contrato gerado");
  }

  if (isLoading || !data) {
    return (
      <main className="space-y-4">
        <Card className="h-36 animate-pulse" />
        <Card className="h-14 animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-24 animate-pulse" />)}
      </main>
    );
  }

  return (
    <main className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{data.nome}</h1>
            <p className="mt-1 text-sm text-muted">{data.telefone || "Sem telefone"} • {data.unidade}</p>
          </div>
          <Badge tone={data.status === "ativo" ? "success" : "danger"}>{data.status}</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-text"> <MessageCircle size={15} className="mr-2 inline" /> WhatsApp </button>
          <button className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-text"> <CalendarPlus size={15} className="mr-2 inline" /> Nova Aula </button>
          <button className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-text"> <ReceiptText size={15} className="mr-2 inline" /> Nova Cobranca </button>
        </div>
      </Card>

      <SegmentedControl options={tabs} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          {tab === "Aulas" && (
            <Section title="Aulas">
              <div className="space-y-3">
                {data.aulas.map((a: any) => (
                  <Card key={a.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold">{a.data} • {a.hora}</p>
                      <p className="text-sm text-muted">{a.unidade}</p>
                    </div>
                    <Badge tone={a.status === "confirmada" || a.status === "realizada" ? "success" : a.status === "pendente" ? "default" : "danger"}>{a.status}</Badge>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {tab === "Financeiro" && (
            <Section title="Financeiro">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card><p className="text-sm text-muted">Total em aberto</p><p className="text-2xl font-semibold">{resumoFinanceiro.aberto}</p></Card>
                <Card><p className="text-sm text-muted">Total pago</p><p className="text-2xl font-semibold">{resumoFinanceiro.pago}</p></Card>
                <Card><p className="text-sm text-muted">Proximo vencimento</p><p className="text-2xl font-semibold">{resumoFinanceiro.proximo}</p></Card>
              </div>
              <div className="mt-3 space-y-3">
                {data.financeiro.map((f: any) => (
                  <Card key={f.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-xl font-semibold">R$ {Number(f.valor).toFixed(2)}</p>
                      <p className="text-sm text-muted">Vencimento: {f.vencimento}</p>
                    </div>
                    <Badge tone={f.status === "pago" ? "success" : "danger"}>{f.status}</Badge>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {tab === "Contratos" && (
            <Section title="Contratos">
              <div className="space-y-3">
                {data.contratos.map((c: any) => (
                  <Card key={c.id} className="space-y-2 p-4">
                    <p className="text-lg font-semibold">{c.plano}</p>
                    <p className="text-sm text-muted">Inicio: {c.inicio} • Fim: {c.fim}</p>
                    <div className="flex items-center justify-between">
                      <Badge tone="success">{c.status}</Badge>
                      <button onClick={visualizarContrato} className="rounded-xl border border-border px-3 py-2 text-sm">Visualizar contrato</button>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {tab === "WhatsApp" && (
            <Section title="WhatsApp">
              <div className="space-y-3">
                {data.mensagens.map((m: any) => (
                  <Card key={m.id} className="space-y-1 p-4">
                    <p className="text-sm">{m.texto}</p>
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>{m.quando}</span>
                      <span>{m.status}</span>
                    </div>
                  </Card>
                ))}
                <button className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white">Enviar nova mensagem</button>
              </div>
            </Section>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
