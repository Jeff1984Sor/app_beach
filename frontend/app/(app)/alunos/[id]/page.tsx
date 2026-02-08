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

type Aula = { id: number; data: string; hora: string; unidade: string; status: "confirmada" | "pendente" | "cancelada" };
type Fatura = { id: number; valor: string; status: "aberto" | "pago"; vencimento: string };
type Contrato = { id: number; plano: string; inicio: string; fim: string; status: string };
type Msg = { id: number; texto: string; status: "enviado" | "entregue" | "lida"; quando: string };

type AlunoFicha = {
  id: number;
  nome: string;
  status: "ativo" | "inativo";
  telefone: string;
  unidade: string;
  aulas: Aula[];
  financeiro: Fatura[];
  contratos: Contrato[];
  mensagens: Msg[];
};

async function fetchFicha(id: string): Promise<AlunoFicha> {
  await new Promise((r) => setTimeout(r, 500));
  return {
    id: Number(id),
    nome: id === "2" ? "Jeff Santos" : "Ana Costa",
    status: "ativo",
    telefone: "(71) 99999-1101",
    unidade: "Unidade Sul",
    aulas: [
      { id: 1, data: "10/02/2026", hora: "08:00", unidade: "Unidade Sul", status: "confirmada" },
      { id: 2, data: "12/02/2026", hora: "09:30", unidade: "Unidade Sul", status: "pendente" },
    ],
    financeiro: [
      { id: 1, valor: "R$ 380,00", status: "aberto", vencimento: "10/02/2026" },
      { id: 2, valor: "R$ 380,00", status: "pago", vencimento: "10/01/2026" },
    ],
    contratos: [{ id: 1, plano: "Mensal Gold", inicio: "01/02/2026", fim: "29/02/2026", status: "Ativo" }],
    mensagens: [
      { id: 1, texto: "Confirmando aula de amanha as 08:00.", status: "lida", quando: "Hoje 10:21" },
      { id: 2, texto: "Perfeito, estarei presente.", status: "entregue", quando: "Hoje 10:24" },
    ],
  };
}

const tabs = ["Aulas", "Financeiro", "Contratos", "WhatsApp"];

export default function AlunoFichaPage() {
  const params = useParams<{ id: string }>();
  const [tab, setTab] = useState("Aulas");
  const { data, isLoading } = useQuery({ queryKey: ["aluno-ficha", params.id], queryFn: () => fetchFicha(params.id) });

  const resumoFinanceiro = useMemo(() => {
    if (!data) return { aberto: "R$ 0", pago: "R$ 0", proximo: "--" };
    const aberto = data.financeiro.filter((x) => x.status === "aberto").length * 380;
    const pago = data.financeiro.filter((x) => x.status === "pago").length * 380;
    const prox = data.financeiro.find((x) => x.status === "aberto")?.vencimento || "--";
    return { aberto: `R$ ${aberto},00`, pago: `R$ ${pago},00`, proximo: prox };
  }, [data]);

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
            <p className="mt-1 text-sm text-muted">{data.telefone} • {data.unidade}</p>
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
                {data.aulas.map((a) => (
                  <Card key={a.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold">{a.data} • {a.hora}</p>
                      <p className="text-sm text-muted">{a.unidade}</p>
                    </div>
                    <Badge tone={a.status === "confirmada" ? "success" : a.status === "pendente" ? "default" : "danger"}>{a.status}</Badge>
                  </Card>
                ))}
                <button className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white">+ Nova Aula</button>
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
                {data.financeiro.map((f) => (
                  <Card key={f.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-xl font-semibold">{f.valor}</p>
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
                {data.contratos.map((c) => (
                  <Card key={c.id} className="space-y-2 p-4">
                    <p className="text-lg font-semibold">{c.plano}</p>
                    <p className="text-sm text-muted">Inicio: {c.inicio} • Fim: {c.fim}</p>
                    <div className="flex items-center justify-between">
                      <Badge tone="success">{c.status}</Badge>
                      <button className="rounded-xl border border-border px-3 py-2 text-sm">Visualizar contrato</button>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {tab === "WhatsApp" && (
            <Section title="WhatsApp">
              <div className="space-y-3">
                {data.mensagens.map((m) => (
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
