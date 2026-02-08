"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

function formatarDataBR(dataIso: string): string {
  if (!dataIso) return "";
  const m = dataIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dataIso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function calcularIdade(dataIso: string): string {
  if (!dataIso) return "";
  const nasc = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(nasc.getTime())) return "";
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade >= 0 ? String(idade) : "";
}

function addMonths(baseIso: string, months: number): string {
  if (!baseIso) return "";
  const [yy, mm, dd] = baseIso.split("-").map(Number);
  if (!yy || !mm || !dd) return "";
  const base = new Date(yy, mm - 1, dd);
  const out = new Date(base);
  out.setMonth(out.getMonth() + months);
  return out.toISOString().slice(0, 10);
}

async function fetchFicha(id: string) {
  const res = await fetch(`${API_URL}/alunos/${id}/ficha`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar ficha");
  return res.json();
}

const tabs = ["Aulas", "Financeiro", "Contratos", "WhatsApp"];
const planos = [
  { nome: "Mensal Gold", valor: 380, recorrencia: "mensal", aulasSemanais: 3 },
  { nome: "Trimestral Pro", valor: 340, recorrencia: "trimestral", aulasSemanais: 3 },
  { nome: "Semestral Elite", valor: 320, recorrencia: "semestral", aulasSemanais: 3 },
  { nome: "Anual Champion", valor: 300, recorrencia: "anual", aulasSemanais: 3 },
];

export default function AlunoFichaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState(searchParams.get("tab") || "Aulas");
  const [openEdit, setOpenEdit] = useState(false);
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [unidade, setUnidade] = useState("Unidade Sul");
  const [openContrato, setOpenContrato] = useState(false);
  const [planoNome, setPlanoNome] = useState(planos[0].nome);
  const [recorrencia, setRecorrencia] = useState("mensal");
  const [valor, setValor] = useState("380");
  const [qtdAulas, setQtdAulas] = useState("3");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [diasSemana, setDiasSemana] = useState<string[]>(["Seg", "Qua", "Sex"]);
  const [dataFimPreview, setDataFimPreview] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["aluno-ficha", params.id], queryFn: () => fetchFicha(params.id) });

  useEffect(() => {
    const desiredTab = searchParams.get("tab");
    if (desiredTab && tabs.includes(desiredTab)) setTab(desiredTab);
    if (searchParams.get("novoContrato") === "1") {
      setTab("Contratos");
      setOpenContrato(true);
      router.replace(`/alunos/${params.id}?tab=Contratos`);
    }
  }, [searchParams, router, params.id]);

  useEffect(() => {
    const meses = recorrencia === "trimestral" ? 3 : recorrencia === "semestral" ? 6 : recorrencia === "anual" ? 12 : 1;
    setDataFimPreview(addMonths(dataInicio, meses));
  }, [dataInicio, recorrencia]);

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
      body: JSON.stringify({ email, telefone, data_aniversario: aniversario || null, cep: cep || null, endereco: endereco || null, unidade }),
    });
    setOpenEdit(false);
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
    qc.invalidateQueries({ queryKey: ["alunos-lista"] });
  }

  function toggleDia(dia: string) {
    setDiasSemana((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]);
  }

  function selecionarPlano(nomePlano: string) {
    setPlanoNome(nomePlano);
    const plano = planos.find((p) => p.nome === nomePlano);
    if (!plano) return;
    setValor(String(plano.valor));
    setRecorrencia(plano.recorrencia);
    setQtdAulas(String(plano.aulasSemanais));
  }

  async function criarContrato() {
    if (!data) return;
    const res = await fetch(`${API_URL}/alunos/${data.id}/contratos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plano_nome: planoNome,
        recorrencia,
        valor: Number(valor || 0),
        qtd_aulas_semanais: Number(qtdAulas || 0),
        data_inicio: dataInicio,
        dias_semana: diasSemana,
      }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setOpenContrato(false);
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
    if (body?.contrato_id) {
      router.push(`/alunos/${data.id}/agenda-contrato?contratoId=${body.contrato_id}`);
    }
  }

  async function buscarCepEdicao(cepValue: string) {
    const clean = cepValue.replace(/\D/g, "");
    if (clean.length !== 8) return;
    const local = await fetch(`${API_URL}/public/cep/${clean}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    let dataCep = local;
    if (!dataCep || !dataCep.logradouro) {
      const viacep = await fetch(`https://viacep.com.br/ws/${clean}/json/`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (viacep && !viacep.erro) {
        dataCep = { logradouro: viacep.logradouro, bairro: viacep.bairro, cidade: viacep.localidade, uf: viacep.uf };
      }
    }
    if (!dataCep) return;
    const enderecoAuto = [dataCep.logradouro, dataCep.bairro, dataCep.cidade, dataCep.uf].filter(Boolean).join(", ");
    if (enderecoAuto) setEndereco(enderecoAuto);
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
            <p className="mt-1 text-xs text-muted">Email: {data.email || "Nao informado"} • Aniversario: {formatarDataBR(data.data_aniversario || "") || "Nao informado"} • Idade: {calcularIdade(data.data_aniversario || "") || "Nao informada"}</p>
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
          {tab === "Contratos" && <Section title="Contratos"><div className="mb-3"><Button onClick={() => setOpenContrato(true)}>Novo contrato</Button></div><div className="space-y-3">{data.contratos.map((c: any) => <Card key={c.id} className="space-y-2 p-4"><p className="text-lg font-semibold">{c.plano}</p><p className="text-sm text-muted">Inicio: {c.inicio} • Fim: {c.fim}</p><div className="flex items-center justify-between"><Badge tone="success">{c.status}</Badge></div></Card>)}</div></Section>}
          {tab === "WhatsApp" && <Section title="WhatsApp"><div className="space-y-3">{data.mensagens.map((m: any) => <Card key={m.id} className="space-y-1 p-4"><p className="text-sm">{m.texto}</p><div className="flex items-center justify-between text-xs text-muted"><span>{m.quando}</span><span>{m.status}</span></div></Card>)}</div></Section>}
        </motion.div>
      </AnimatePresence>

      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Editar aluno">
        <div className="space-y-3">
          <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="date" placeholder="Data de aniversario" value={aniversario} onChange={(e) => setAniversario(e.target.value)} />
            <Input placeholder="Idade (calculada)" value={calcularIdade(aniversario)} readOnly />
          </div>
          <Input
            placeholder="CEP"
            value={cep}
            onChange={(e) => {
              const v = e.target.value;
              setCep(v);
              if (v.replace(/\D/g, "").length === 8) buscarCepEdicao(v);
            }}
            onBlur={(e) => buscarCepEdicao(e.target.value)}
          />
          <Input placeholder="Endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option>Unidade Sul</option><option>Unidade Centro</option><option>Unidade Norte</option>
          </select>
          <Button className="w-full" onClick={salvarEdicao}>Salvar alteracoes</Button>
        </div>
      </Modal>

      <Modal open={openContrato} onClose={() => setOpenContrato(false)} title="Novo contrato">
        <div className="space-y-3">
          <select value={planoNome} onChange={(e) => selecionarPlano(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            {planos.map((p) => (
              <option key={p.nome} value={p.nome}>{p.nome}</option>
            ))}
          </select>
          <Input placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} />
          <select value={recorrencia} onChange={(e) => setRecorrencia(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>
          <Input placeholder="Quantidade de aulas semanais" value={qtdAulas} onChange={(e) => setQtdAulas(e.target.value)} />
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          <Input value={formatarDataBR(dataFimPreview)} readOnly placeholder="Data fim" />
          <div className="flex flex-wrap gap-2">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((d) => (
              <button key={d} onClick={() => toggleDia(d)} className={`rounded-xl px-3 py-2 text-sm ${diasSemana.includes(d) ? "bg-primary text-white" : "border border-border bg-white text-text"}`}>
                {d}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={criarContrato}>Salvar contrato e escolher dias na agenda</Button>
        </div>
      </Modal>
    </main>
  );
}
