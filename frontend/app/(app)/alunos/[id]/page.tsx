"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarPlus, MessageCircle, ReceiptText, Pencil, Trash2 } from "lucide-react";
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
type PlanoOption = { nome: string; valor: number; recorrencia: string; aulasSemanais: number };
const horasCheias = Array.from({ length: 15 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

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
  const [unidade, setUnidade] = useState("");
  const [openContrato, setOpenContrato] = useState(false);
  const [planoNome, setPlanoNome] = useState("");
  const [recorrencia, setRecorrencia] = useState("");
  const [valor, setValor] = useState("");
  const [qtdAulas, setQtdAulas] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [dataFimPreview, setDataFimPreview] = useState("");
  const [horaAula, setHoraAula] = useState("");
  const [editingContratoId, setEditingContratoId] = useState<number | null>(null);
  const [msgContrato, setMsgContrato] = useState<string>("");
  const [openReagendar, setOpenReagendar] = useState(false);
  const [aulaSelecionadaId, setAulaSelecionadaId] = useState<number | null>(null);
  const [reagendarData, setReagendarData] = useState("");
  const [reagendarHora, setReagendarHora] = useState("");
  const [aulasSelecionadas, setAulasSelecionadas] = useState<number[]>([]);
  const [financeiroFiltro, setFinanceiroFiltro] = useState<"aberto" | "pago">("aberto");
  const [openPagar, setOpenPagar] = useState(false);
  const [contaSelecionadaPagar, setContaSelecionadaPagar] = useState<number | null>(null);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [contaBancariaId, setContaBancariaId] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["aluno-ficha", params.id], queryFn: () => fetchFicha(params.id) });
  const { data: unidades = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["unidades"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/unidades`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: planosApi = [] } = useQuery<any[]>({
    queryKey: ["planos-contrato"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/planos`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: contasBancarias = [] } = useQuery<any[]>({
    queryKey: ["contas-bancarias"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/contas-bancarias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const planos = useMemo<PlanoOption[]>(
    () =>
      planosApi.map((p: any) => ({
        nome: p.nome,
        valor: Number(p.valor || 0),
        recorrencia: String(p.recorrencia || "mensal"),
        aulasSemanais: Number(p.qtd_aulas_semanais ?? p.aulasSemanais ?? 0),
      })),
    [planosApi]
  );

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

  useEffect(() => {
    if (!planos.length || !planoNome) return;
    const selected = planos.find((p) => p.nome === planoNome);
    if (!selected) return;
    setValor(String(selected.valor));
    setRecorrencia(selected.recorrencia);
    setQtdAulas(String(selected.aulasSemanais));
  }, [planos, planoNome]);

  const resumoFinanceiro = useMemo(() => {
    if (!data) return { aberto: "R$ 0", pago: "R$ 0", proximo: "--" };
    const aberto = data.financeiro.filter((x: any) => x.status === "aberto").reduce((a: number, b: any) => a + Number(b.valor), 0);
    const pago = data.financeiro.filter((x: any) => x.status === "pago").reduce((a: number, b: any) => a + Number(b.valor), 0);
    const prox = data.financeiro.find((x: any) => x.status === "aberto")?.vencimento || "--";
    return { aberto: `R$ ${aberto.toFixed(2)}`, pago: `R$ ${pago.toFixed(2)}`, proximo: prox };
  }, [data]);
  const financeiroFiltrado = useMemo(
    () => (data?.financeiro || []).filter((x: any) => (financeiroFiltro ? String(x.status || "").toLowerCase() === financeiroFiltro : true)),
    [data, financeiroFiltro]
  );

  function abrirEdicao() {
    if (!data) return;
    setEmail(data.email || "");
    setTelefone(data.telefone || "");
    setAniversario(data.data_aniversario || "");
    setCep(data.cep || "");
    setEndereco(data.endereco || "");
    setUnidade(data.unidade || "");
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
    setDiasSemana((prev) => {
      if (prev.includes(dia)) return prev.filter((d) => d !== dia);
      const limite = Number(qtdAulas || 0);
      if (limite <= 0) {
        setMsgContrato("Selecione um plano antes de escolher os dias.");
        return prev;
      }
      if (prev.length >= limite) {
        setMsgContrato(`Este plano permite no maximo ${limite} dia(s) por semana.`);
        return prev;
      }
      setMsgContrato("");
      return [...prev, dia];
    });
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
    if (!planoNome) {
      setMsgContrato("Cadastre e selecione um plano antes de salvar o contrato.");
      return;
    }
    if (!dataInicio) {
      setMsgContrato("Informe a data de inicio do contrato.");
      return;
    }
    if (!horaAula) {
      setMsgContrato("Selecione o horario.");
      return;
    }
    setMsgContrato("");
    const url = editingContratoId
      ? `${API_URL}/alunos/${data.id}/contratos/${editingContratoId}`
      : `${API_URL}/alunos/${data.id}/contratos`;
    const method = editingContratoId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
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
    const body = await res.json().catch(() => ({}));
    let contratoIdReserva = editingContratoId || body?.contrato_id;
    if (contratoIdReserva) {
      const reservaRes = await fetch(`${API_URL}/alunos/${data.id}/contratos/${contratoIdReserva}/reservas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dias_semana: diasSemana,
          hora_inicio: horaAula,
          duracao_minutos: 60,
          unidade: data.unidade,
        }),
      });
      if (!reservaRes.ok) {
        const erro = await reservaRes.json().catch(() => ({}));
        setMsgContrato(erro.detail || "Contrato salvo, mas falhou ao reservar aulas.");
      }
    }

    setOpenContrato(false);
    setEditingContratoId(null);
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
    if (!editingContratoId && body?.contrato_id) {
      setMsgContrato("Contrato e aulas criados com sucesso.");
    }
    setTab("Aulas");
  }

  function abrirReagendar(aula: any) {
    setAulaSelecionadaId(aula.id);
    const [dd, mm, yyyy] = String(aula.data || "").split("/");
    setReagendarData(dd && mm && yyyy ? `${yyyy}-${mm}-${dd}` : "");
    setReagendarHora(aula.hora || "");
    setOpenReagendar(true);
  }

  async function salvarReagendamento() {
    if (!data || !aulaSelecionadaId) return;
    const res = await fetch(`${API_URL}/alunos/${data.id}/aulas/${aulaSelecionadaId}/reagendar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: reagendarData, hora: reagendarHora }),
    });
    if (!res.ok) return;
    setOpenReagendar(false);
    setAulaSelecionadaId(null);
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
  }

  async function deletarAula(aulaId: number) {
    if (!data) return;
    if (!window.confirm("Deseja realmente deletar esta aula?")) return;
    const res = await fetch(`${API_URL}/alunos/${data.id}/aulas/${aulaId}`, { method: "DELETE" });
    if (!res.ok) return;
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
  }

  function toggleAulaSelecionada(aulaId: number) {
    setAulasSelecionadas((prev) => (prev.includes(aulaId) ? prev.filter((id) => id !== aulaId) : [...prev, aulaId]));
  }

  function selecionarTodasAulas() {
    const selecionaveis = (data?.aulas || [])
      .filter((a: any) => String(a.status || "").toLowerCase() !== "realizada")
      .map((a: any) => a.id as number);
    if (aulasSelecionadas.length === selecionaveis.length) {
      setAulasSelecionadas([]);
      return;
    }
    setAulasSelecionadas(selecionaveis);
  }

  async function excluirAulasSelecionadas() {
    if (!data || aulasSelecionadas.length === 0) return;
    if (!window.confirm(`Deseja excluir ${aulasSelecionadas.length} aula(s)?`)) return;
    for (const aulaId of aulasSelecionadas) {
      await fetch(`${API_URL}/alunos/${data.id}/aulas/${aulaId}`, { method: "DELETE" });
    }
    setAulasSelecionadas([]);
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
  }

  function abrirEdicaoContrato(c: any) {
    setEditingContratoId(c.id);
    selecionarPlano(c.plano);
    setDataInicio(c.inicio_iso || new Date().toISOString().slice(0, 10));
    setDiasSemana(c.dias_semana?.length ? c.dias_semana : ["Seg", "Qua", "Sex"]);
    setOpenContrato(true);
  }

  async function deletarContrato(contratoId: number) {
    if (!data) return;
    if (!window.confirm("Deseja realmente deletar este contrato?")) return;
    const res = await fetch(`${API_URL}/alunos/${data.id}/contratos/${contratoId}`, { method: "DELETE" });
    if (!res.ok) return;
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
  }

  async function alterarVencimento(contaId: number) {
    if (!data) return;
    const novo = window.prompt("Novo vencimento (AAAA-MM-DD):", new Date().toISOString().slice(0, 10));
    if (!novo) return;
    await fetch(`${API_URL}/alunos/${data.id}/financeiro/${contaId}/vencimento`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vencimento: novo }),
    });
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
  }

  async function excluirLancamento(contaId: number) {
    if (!data) return;
    if (!window.confirm("Deseja excluir este lancamento?")) return;
    await fetch(`${API_URL}/alunos/${data.id}/financeiro/${contaId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
  }

  function abrirPagar(contaId: number) {
    setContaSelecionadaPagar(contaId);
    setDataPagamento(new Date().toISOString().slice(0, 10));
    setContaBancariaId("");
    setOpenPagar(true);
  }

  async function confirmarPagamento() {
    if (!data || !contaSelecionadaPagar) return;
    await fetch(`${API_URL}/alunos/${data.id}/financeiro/${contaSelecionadaPagar}/pagar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data_pagamento: dataPagamento,
        conta_bancaria_id: contaBancariaId ? Number(contaBancariaId) : null,
      }),
    });
    setOpenPagar(false);
    setContaSelecionadaPagar(null);
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
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
          {tab === "Aulas" && (
            <Section title="Aulas">
              <div className="mb-3 flex flex-wrap gap-2">
                <button onClick={selecionarTodasAulas} className="rounded-xl border border-border px-3 py-2 text-sm text-text hover:bg-bg">
                  {aulasSelecionadas.length > 0 ? "Desmarcar todas" : "Selecionar todas"}
                </button>
                <button
                  onClick={excluirAulasSelecionadas}
                  disabled={aulasSelecionadas.length === 0}
                  className="rounded-xl border border-border px-3 py-2 text-sm text-danger enabled:hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Excluir selecionadas ({aulasSelecionadas.length})
                </button>
              </div>
              <div className="space-y-3">
                {data.aulas.map((a: any) => (
                  <Card key={a.id} className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#0A84FF]"
                          checked={aulasSelecionadas.includes(a.id)}
                          disabled={String(a.status || "").toLowerCase() === "realizada"}
                          onChange={() => toggleAulaSelecionada(a.id)}
                        />
                        <div>
                          <p className="font-semibold">{a.data} • {a.hora}</p>
                          <p className="text-sm text-muted">{a.unidade}</p>
                        </div>
                      </div>
                      <Badge tone={a.status === "confirmada" || a.status === "realizada" ? "success" : a.status === "pendente" ? "default" : "danger"}>{a.status}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => abrirReagendar(a)} className="rounded-xl border border-border px-3 py-2 text-sm text-text hover:bg-bg">Reagendar</button>
                      <button onClick={() => deletarAula(a.id)} className="rounded-xl border border-border px-3 py-2 text-sm text-danger hover:bg-danger/10">Deletar</button>
                    </div>
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
              <div className="mt-4 flex gap-2">
                <button onClick={() => setFinanceiroFiltro("aberto")} className={`rounded-xl px-3 py-2 text-sm ${financeiroFiltro === "aberto" ? "bg-primary text-white" : "border border-border bg-white text-text"}`}>Em aberto</button>
                <button onClick={() => setFinanceiroFiltro("pago")} className={`rounded-xl px-3 py-2 text-sm ${financeiroFiltro === "pago" ? "bg-primary text-white" : "border border-border bg-white text-text"}`}>Pagas</button>
              </div>
              <div className="mt-3 space-y-3">
                {financeiroFiltrado.map((f: any) => (
                  <Card key={f.id} className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-semibold">{Number(f.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                      <Badge tone={String(f.status || "").toLowerCase() === "pago" ? "success" : "default"}>{f.status}</Badge>
                    </div>
                    <p className="text-sm text-muted">Vencimento: {f.vencimento}{f.data_pagamento ? ` • Pago em: ${f.data_pagamento}` : ""}</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => alterarVencimento(f.id)} className="rounded-xl border border-border px-3 py-2 text-sm text-text hover:bg-bg">Alterar vencimento</button>
                      <button onClick={() => excluirLancamento(f.id)} className="rounded-xl border border-border px-3 py-2 text-sm text-danger hover:bg-danger/10">Excluir</button>
                      {String(f.status || "").toLowerCase() !== "pago" && (
                        <button onClick={() => abrirPagar(f.id)} className="rounded-xl bg-primary px-3 py-2 text-sm text-white">Pagar</button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}
          {tab === "Contratos" && <Section title="Contratos"><div className="mb-3"><Button onClick={() => { setEditingContratoId(null); setPlanoNome(""); setValor(""); setRecorrencia(""); setQtdAulas(""); setDataInicio(""); setHoraAula(""); setDiasSemana([]); setMsgContrato(""); setOpenContrato(true); }}>Novo contrato</Button></div><div className="space-y-3">{data.contratos.map((c: any) => <Card key={c.id} className="space-y-2 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-lg font-semibold">{c.plano}</p><p className="text-sm text-muted">Inicio: {c.inicio} • Fim: {c.fim}</p></div><div className="flex items-center gap-2"><button onClick={() => abrirEdicaoContrato(c)} className="rounded-xl border border-border p-2 text-muted hover:bg-bg"><Pencil size={14} /></button><button onClick={() => deletarContrato(c.id)} className="rounded-xl border border-border p-2 text-danger hover:bg-danger/10"><Trash2 size={14} /></button></div></div><div className="flex items-center justify-between"><Badge tone="success">{c.status}</Badge></div></Card>)}</div></Section>}
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
            <option value="">Selecione a unidade</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.nome}>{u.nome}</option>
            ))}
          </select>
          <Button className="w-full" onClick={salvarEdicao}>Salvar alteracoes</Button>
        </div>
      </Modal>

      <Modal open={openContrato} onClose={() => { setOpenContrato(false); setEditingContratoId(null); }} title={editingContratoId ? "Editar contrato" : "Novo contrato"}>
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Plano</p>
          <select value={planoNome} onChange={(e) => selecionarPlano(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione o plano</option>
            {planos.map((p) => (
              <option key={p.nome} value={p.nome}>{p.nome}</option>
            ))}
          </select>

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Valor</p>
          <Input value={Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} readOnly />

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Recorrencia</p>
          <Input value={recorrencia.charAt(0).toUpperCase() + recorrencia.slice(1)} readOnly />

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Numero de aulas por semana</p>
          <Input value={qtdAulas} readOnly />

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Data de inicio</p>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Data de encerramento</p>
          <Input value={formatarDataBR(dataFimPreview)} readOnly />

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Dias da semana</p>
          <div className="flex flex-wrap gap-2">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((d) => (
              <button key={d} onClick={() => toggleDia(d)} className={`rounded-xl px-3 py-2 text-sm ${diasSemana.includes(d) ? "bg-primary text-white" : "border border-border bg-white text-text"}`}>
                {d}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Selecionados: {diasSemana.length}/{qtdAulas}</p>

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Horario</p>
          <select value={horaAula} onChange={(e) => setHoraAula(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione o horario</option>
            {horasCheias.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>

          {msgContrato && <p className="text-sm text-danger">{msgContrato}</p>}
          <Button className="w-full" onClick={criarContrato}>{editingContratoId ? "Salvar alteracoes do contrato" : "Salvar contrato e criar aulas"}</Button>
        </div>
      </Modal>

      <Modal open={openReagendar} onClose={() => setOpenReagendar(false)} title="Reagendar aula">
        <div className="space-y-3">
          <Input type="date" value={reagendarData} onChange={(e) => setReagendarData(e.target.value)} />
          <select value={reagendarHora} onChange={(e) => setReagendarHora(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione o horario</option>
            {horasCheias.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <Button className="w-full" onClick={salvarReagendamento}>Salvar reagendamento</Button>
        </div>
      </Modal>

      <Modal open={openPagar} onClose={() => setOpenPagar(false)} title="Baixar recebimento">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Data de pagamento</p>
          <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Conta bancaria</p>
          <select value={contaBancariaId} onChange={(e) => setContaBancariaId(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione a conta</option>
            {contasBancarias.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nome_conta} - {c.banco}</option>
            ))}
          </select>
          <Button className="w-full" onClick={confirmarPagamento}>Confirmar pagamento</Button>
        </div>
      </Modal>
    </main>
  );
}
