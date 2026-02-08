"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarPlus, MessageCircle, ReceiptText, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

async function fetchFicha(id: string) {
  const res = await fetch(`${API_URL}/alunos/${id}/ficha`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar ficha");
  return res.json();
}

const tabs = ["Aulas", "Financeiro", "Contratos", "WhatsApp"];

export default function AlunoFichaPage() {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState("Aulas");
  const [openEdit, setOpenEdit] = useState(false);
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [idade, setIdade] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [unidade, setUnidade] = useState("Unidade Sul");

  const { data, isLoading } = useQuery({ queryKey: ["aluno-ficha", params.id], queryFn: () => fetchFicha(params.id) });

  const resumoFinanceiro = useMemo(() => {
    if (!data) return { aberto: "R$ 0", pago: "R$ 0", proximo: "--" };
    const aberto = data.financeiro.filter((x: any) => x.status === "aberto").reduce((a: number, b: any) => a + Number(b.valor), 0);
    const pago = data.financeiro.filter((x: any) => x.status === "pago").reduce((a: number, b: any) => a + Number(b.valor), 0);
    const prox = data.financeiro.find((x: any) => x.status === "aberto")?.vencimento || "--";
    return { aberto: `R$ ${aberto.toFixed(2)}`, pago: `R$ ${pago.toFixed(2)}`, proximo: prox };
  }, [data]);

  function abrirEdicao() {
    if (!data) return;
    setEmail(data.email || "");
    setTelefone(data.telefone || "");
    setAniversario(data.data_aniversario || "");
    setIdade(data.idade ? String(data.idade) : "");
    setCep(data.cep || "");
    setEndereco(data.endereco || "");
    setUnidade(data.unidade || "Unidade Sul");
    setOpenEdit(true);
  }

  async function salvarEdicao() {
    if (!data) return;
    await fetch(`${API_URL}/alunos/${data.id}/detalhes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, telefone, data_aniversario: aniversario || null, idade: idade ? Number(idade) : null, cep: cep || null, endereco: endereco || null, unidade }),
    });
    setOpenEdit(false);
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
    qc.invalidateQueries({ queryKey: ["alunos-lista"] });
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
            <p className="mt-1 text-xs text-muted">Email: {data.email || "Nao informado"} • Aniversario: {data.data_aniversario || "Nao informado"} • Idade: {data.idade || "Nao informada"}</p>
            <p className="mt-1 text-xs text-muted">Endereco: {data.endereco || "Nao informado"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={data.status === "ativo" ? "success" : "danger"}>{data.status}</Badge>
            <button onClick={abrirEdicao} className="rounded-xl border border-border p-2 text-muted"><Pencil size={16} /></button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <a href={`https://wa.me/55${String(data.telefone || "").replace(/\D/g, "")}`} target="_blank" className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-text"> <MessageCircle size={15} className="mr-2 inline" /> WhatsApp </a>
          <button className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-text"> <CalendarPlus size={15} className="mr-2 inline" /> Nova Aula </button>
          <button className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-text"> <ReceiptText size={15} className="mr-2 inline" /> Nova Cobranca </button>
        </div>
      </Card>

      <SegmentedControl options={tabs} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          {tab === "Aulas" && <Section title="Aulas"><div className="space-y-3">{data.aulas.map((a: any) => <Card key={a.id} className="flex items-center justify-between p-4"><div><p className="font-semibold">{a.data} • {a.hora}</p><p className="text-sm text-muted">{a.unidade}</p></div><Badge tone={a.status === "confirmada" || a.status === "realizada" ? "success" : a.status === "pendente" ? "default" : "danger"}>{a.status}</Badge></Card>)}</div></Section>}
          {tab === "Financeiro" && <Section title="Financeiro"><div className="grid gap-3 sm:grid-cols-3"><Card><p className="text-sm text-muted">Total em aberto</p><p className="text-2xl font-semibold">{resumoFinanceiro.aberto}</p></Card><Card><p className="text-sm text-muted">Total pago</p><p className="text-2xl font-semibold">{resumoFinanceiro.pago}</p></Card><Card><p className="text-sm text-muted">Proximo vencimento</p><p className="text-2xl font-semibold">{resumoFinanceiro.proximo}</p></Card></div></Section>}
          {tab === "Contratos" && <Section title="Contratos"><div className="space-y-3">{data.contratos.map((c: any) => <Card key={c.id} className="space-y-2 p-4"><p className="text-lg font-semibold">{c.plano}</p><p className="text-sm text-muted">Inicio: {c.inicio} • Fim: {c.fim}</p><div className="flex items-center justify-between"><Badge tone="success">{c.status}</Badge></div></Card>)}</div></Section>}
          {tab === "WhatsApp" && <Section title="WhatsApp"><div className="space-y-3">{data.mensagens.map((m: any) => <Card key={m.id} className="space-y-1 p-4"><p className="text-sm">{m.texto}</p><div className="flex items-center justify-between text-xs text-muted"><span>{m.quando}</span><span>{m.status}</span></div></Card>)}</div></Section>}
        </motion.div>
      </AnimatePresence>

      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Editar aluno">
        <div className="space-y-3">
          <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="date" placeholder="Data de aniversario" value={aniversario} onChange={(e) => setAniversario(e.target.value)} />
            <Input placeholder="Idade" value={idade} onChange={(e) => setIdade(e.target.value)} />
          </div>
          <Input placeholder="CEP" value={cep} onChange={(e) => setCep(e.target.value)} />
          <Input placeholder="Endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option>Unidade Sul</option><option>Unidade Centro</option><option>Unidade Norte</option>
          </select>
          <Button className="w-full" onClick={salvarEdicao}>Salvar alteracoes</Button>
        </div>
      </Modal>
    </main>
  );
}
