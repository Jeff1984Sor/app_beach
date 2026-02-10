"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarPlus, CheckCircle2, MessageCircle, MinusCircle, Pencil, PhoneCall, Trash2 } from "lucide-react";
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

function aulaStatusMeta(statusRaw: string) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "realizada") return { label: "Realizada", tone: "success" as const, icon: CheckCircle2 };
  if (s === "falta_aviso") return { label: "Falta avisada", tone: "default" as const, icon: PhoneCall };
  if (s === "falta") return { label: "Falta", tone: "danger" as const, icon: MinusCircle };
  if (s === "cancelada") return { label: "Cancelada", tone: "danger" as const, icon: MinusCircle };
  return { label: "Agendada", tone: "default" as const, icon: CalendarPlus };
}

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
  const [unidadeId, setUnidadeId] = useState("");
  const [openContrato, setOpenContrato] = useState(false);
  const [planoNome, setPlanoNome] = useState("");
  const [recorrencia, setRecorrencia] = useState("");
  const [valor, setValor] = useState("");
  const [qtdAulas, setQtdAulas] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [dataFimPreview, setDataFimPreview] = useState("");
  const [horaAula, setHoraAula] = useState("");
  const [contratoProfessorId, setContratoProfessorId] = useState("");
  const [editingContratoId, setEditingContratoId] = useState<number | null>(null);
  const [msgContrato, setMsgContrato] = useState<string>("");
  const [openReagendar, setOpenReagendar] = useState(false);
  const [aulaSelecionadaId, setAulaSelecionadaId] = useState<number | null>(null);
  const [reagendarData, setReagendarData] = useState("");
  const [reagendarHora, setReagendarHora] = useState("");
  const [reagendarProfessorId, setReagendarProfessorId] = useState("");
  const [reagendarMsg, setReagendarMsg] = useState<string | null>(null);
  const [reagendarLoading, setReagendarLoading] = useState(false);
  const [aulasSelecionadas, setAulasSelecionadas] = useState<number[]>([]);
  const [aulasFiltroStatus, setAulasFiltroStatus] = useState<
    "todas_exceto_realizada" | "todas" | "agendada" | "realizada" | "falta" | "falta_aviso" | "cancelada"
  >("todas_exceto_realizada");
  const [financeiroFiltro, setFinanceiroFiltro] = useState<"aberto" | "pago">("aberto");
  const [openPagar, setOpenPagar] = useState(false);
  const [contaSelecionadaPagar, setContaSelecionadaPagar] = useState<number | null>(null);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [openAulaAvulsa, setOpenAulaAvulsa] = useState(false);
  const [openDesconto, setOpenDesconto] = useState(false);
  const [descontoAulaId, setDescontoAulaId] = useState<number | null>(null);
  const [descontoValor, setDescontoValor] = useState<number | null>(null);
  const [descontoLoading, setDescontoLoading] = useState(false);
  const [descontoMsg, setDescontoMsg] = useState<string | null>(null);
  const [avulsaData, setAvulsaData] = useState(new Date().toISOString().slice(0, 10));
  const [avulsaProfessorId, setAvulsaProfessorId] = useState("");
  const [avulsaHora, setAvulsaHora] = useState("");
  const [avulsaValor, setAvulsaValor] = useState("");
  const [avulsaCategoria, setAvulsaCategoria] = useState("");
  const [avulsaSubcategoria, setAvulsaSubcategoria] = useState("");
  const [avulsaMsg, setAvulsaMsg] = useState("");

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
  const { data: professores = [] } = useQuery<any[]>({
    queryKey: ["agenda-professores"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/agenda/professores`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: categorias = [] } = useQuery<any[]>({
    queryKey: ["categorias-aluno"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/categorias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: subcategorias = [] } = useQuery<any[]>({
    queryKey: ["subcategorias-aluno"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/subcategorias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: disponibilidadeAvulsa } = useQuery<{ horarios_livres: string[] }>({
    queryKey: ["disponibilidade-avulsa", params.id, avulsaData, avulsaProfessorId],
    queryFn: async () => {
      if (!avulsaProfessorId || !avulsaData) return { horarios_livres: [] };
      const qs = new URLSearchParams({ data: avulsaData, professor_id: avulsaProfessorId, duracao_minutos: "60" });
      const res = await fetch(`${API_URL}/alunos/${params.id}/aulas-avulsas/disponibilidade?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) return { horarios_livres: [] };
      return res.json();
    },
    enabled: openAulaAvulsa && !!avulsaProfessorId && !!avulsaData,
  });
  const subcategoriasFiltradasAvulsa = useMemo(
    () => subcategorias.filter((s: any) => !avulsaCategoria || s.categoria_nome === avulsaCategoria),
    [subcategorias, avulsaCategoria]
  );
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
  const aulasFiltradas = useMemo(() => {
    const aulas = (data?.aulas || []) as any[];
    const norm = (s: any) => String(s || "").toLowerCase();
    if (aulasFiltroStatus === "todas") return aulas;
    if (aulasFiltroStatus === "todas_exceto_realizada") return aulas.filter((a) => norm(a.status) !== "realizada");
    return aulas.filter((a) => norm(a.status) === aulasFiltroStatus);
  }, [data, aulasFiltroStatus]);

  function abrirEdicao() {
    if (!data) return;
    setEmail(data.email || "");
    setTelefone(data.telefone || "");
    setAniversario(data.data_aniversario || "");
    setCep(data.cep || "");
    setEndereco(data.endereco || "");
    const un = unidades.find((u) => u.nome === data.unidade);
    setUnidadeId(un ? String(un.id) : "");
    setOpenEdit(true);
  }

  async function salvarEdicao() {
    if (!data) return;
    await fetch(`${API_URL}/alunos/${data.id}/detalhes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        telefone,
        data_aniversario: aniversario || null,
        cep: cep || null,
        endereco: endereco || null,
        unidade_id: unidadeId ? Number(unidadeId) : null,
      }),
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
    if (!contratoProfessorId) {
      setMsgContrato("Selecione o professor do contrato.");
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
        professor_id: Number(contratoProfessorId),
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
          professor_id: Number(contratoProfessorId),
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
    setReagendarProfessorId(aula.professor_id ? String(aula.professor_id) : (professores?.[0]?.id ? String(professores[0].id) : ""));
    setReagendarMsg(null);
    setOpenReagendar(true);
  }

  async function salvarReagendamento() {
    if (!data || !aulaSelecionadaId) return;
    setReagendarLoading(true);
    setReagendarMsg(null);
    const ctrl = new AbortController();
    const to = window.setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${API_URL}/alunos/${data.id}/aulas/${aulaSelecionadaId}/reagendar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: reagendarData, hora: reagendarHora, professor_id: reagendarProfessorId ? Number(reagendarProfessorId) : null }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        setReagendarMsg(erro.detail || "Falha ao salvar reagendamento.");
        return;
      }
      setOpenReagendar(false);
      setAulaSelecionadaId(null);
      qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
    } catch (e: any) {
      setReagendarMsg(e?.name === "AbortError" ? "Tempo esgotado ao salvar. Tente novamente." : "Falha de rede ao salvar. Tente novamente.");
    } finally {
      window.clearTimeout(to);
      setReagendarLoading(false);
    }
  }

  function abrirDesconto(aula: any) {
    setDescontoAulaId(Number(aula?.id));
    setDescontoValor(null);
    setDescontoMsg(null);
    setOpenDesconto(true);
  }

  async function confirmarDesconto() {
    if (!params.id || !descontoAulaId) return;
    setDescontoLoading(true);
    setDescontoMsg(null);
    try {
      const res = await fetch(`${API_URL}/alunos/${params.id}/aulas/${descontoAulaId}/descontar`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDescontoMsg(body?.detail || "Falha ao descontar.");
        return;
      }
      const v = Number(body?.desconto_valor || 0);
      setDescontoValor(v);
      setDescontoMsg("Valor descontado com sucesso. Deseja cancelar a aula?");
    } catch (e: any) {
      setDescontoMsg(e?.name === "AbortError" ? "Tempo esgotado. Tente novamente." : "Falha de rede ao descontar. Tente novamente.");
    } finally {
      setDescontoLoading(false);
      qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
    }
  }

  async function cancelarAulaDescontada() {
    if (!params.id || !descontoAulaId) return;
    try {
      const res = await fetch(`${API_URL}/alunos/${params.id}/aulas/${descontoAulaId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelada" }),
      });
      if (!res.ok) return;
      setOpenDesconto(false);
    } finally {
      qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
      qc.invalidateQueries({ queryKey: ["home-kpis"] });
    }
  }

  async function deletarAula(aulaId: number) {
    if (!data) return;
    if (!window.confirm("Deseja realmente deletar esta aula?")) return;
    const res = await fetch(`${API_URL}/alunos/${data.id}/aulas/${aulaId}`, { method: "DELETE" });
    if (!res.ok) return;
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
  }

  async function marcarStatusAula(aulaId: number, status: "realizada" | "falta_aviso" | "falta" | "agendada") {
    if (!data) return;
    const res = await fetch(`${API_URL}/alunos/${data.id}/aulas/${aulaId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    qc.invalidateQueries({ queryKey: ["aluno-ficha", params.id] });
  }

  function toggleAulaSelecionada(aulaId: number) {
    setAulasSelecionadas((prev) => (prev.includes(aulaId) ? prev.filter((id) => id !== aulaId) : [...prev, aulaId]));
  }

  function selecionarTodasAulas() {
    const selecionaveis = aulasFiltradas
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
    setDiasSemana(c.dias_semana?.length ? c.dias_semana : []);
    setContratoProfessorId(c.professor_id ? String(c.professor_id) : "");
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

  async function salvarAulaAvulsa() {
    if (!data || !avulsaProfessorId || !avulsaData || !avulsaHora) {
      setAvulsaMsg("Preencha professor, data e horario.");
      return;
    }
    const res = await fetch(`${API_URL}/alunos/${data.id}/aulas-avulsas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        professor_id: Number(avulsaProfessorId),
        data: avulsaData,
        hora: avulsaHora,
        valor: Number(String(avulsaValor || "0").replace(",", ".")),
        categoria: avulsaCategoria || null,
        subcategoria: avulsaSubcategoria || null,
        unidade: data.unidade,
      }),
    });
    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      setAvulsaMsg(erro.detail || "Falha ao salvar aula avulsa.");
      return;
    }
    setOpenAulaAvulsa(false);
    setAvulsaMsg("");
    setAvulsaHora("");
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
          <button
            onClick={() => {
              setOpenAulaAvulsa(true);
              setAvulsaProfessorId(professores?.[0]?.id ? String(professores[0].id) : "");
              setAvulsaData(new Date().toISOString().slice(0, 10));
              setAvulsaHora("");
              setAvulsaValor("");
              setAvulsaCategoria("");
              setAvulsaSubcategoria("");
              setAvulsaMsg("");
            }}
            className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-text"
          > <CalendarPlus size={15} className="mr-2 inline" /> + Aula Avulsa </button>
          {/* removido por enquanto */}
        </div>
      </Card>

      <SegmentedControl options={tabs} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          {tab === "Aulas" && (
            <Section title="Aulas">
              <div className="mb-3 flex flex-wrap gap-2">
                <select
                  value={aulasFiltroStatus}
                  onChange={(e) => setAulasFiltroStatus(e.target.value as any)}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-text outline-none"
                  aria-label="Filtrar status"
                >
                  <option value="todas_exceto_realizada">Status: Todas (exceto Realizada)</option>
                  <option value="todas">Status: Todas (inclui Realizada)</option>
                  <option value="agendada">Status: Agendada</option>
                  <option value="realizada">Status: Realizada</option>
                  <option value="falta_aviso">Status: Falta avisada</option>
                  <option value="falta">Status: Falta</option>
                  <option value="cancelada">Status: Cancelada</option>
                </select>
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
                {aulasFiltradas.map((a: any) => (
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
                          <p className="text-sm text-muted">
                            {a.unidade}
                            {a.professor_nome ? (
                              <span className="text-muted">{` • Prof: ${a.professor_nome}`}</span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <Badge tone={aulaStatusMeta(a.status).tone}>{aulaStatusMeta(a.status).label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        title="Marcar como realizada"
                        onClick={() => marcarStatusAula(a.id, "realizada")}
                        className="rounded-xl border border-border px-3 py-2 text-sm text-success hover:bg-success/10"
                      >
                        <CheckCircle2 size={16} className="mr-2 inline" /> Realizada
                      </button>
                      <button
                        title="Marcar falta avisada"
                        onClick={() => marcarStatusAula(a.id, "falta_aviso")}
                        className="rounded-xl border border-border px-3 py-2 text-sm text-primary hover:bg-primary/10"
                      >
                        <PhoneCall size={16} className="mr-2 inline" /> Falta avisada
                      </button>
                      <button
                        title="Marcar falta"
                        onClick={() => marcarStatusAula(a.id, "falta")}
                        className="rounded-xl border border-border px-3 py-2 text-sm text-danger hover:bg-danger/10"
                      >
                        <MinusCircle size={16} className="mr-2 inline" /> Falta
                      </button>
                      <button
                        title="Marcar como agendada"
                        onClick={() => marcarStatusAula(a.id, "agendada")}
                        className="rounded-xl border border-border px-3 py-2 text-sm text-text hover:bg-bg"
                      >
                        <CalendarPlus size={16} className="mr-2 inline" /> Agendada
                      </button>
                      <button onClick={() => abrirDesconto(a)} className="rounded-xl border border-border px-3 py-2 text-sm text-text hover:bg-bg">
                        <MinusCircle size={16} className="mr-2 inline text-danger" /> Descontar
                      </button>
                      <button onClick={() => abrirReagendar(a)} className="rounded-xl border border-border px-3 py-2 text-sm text-text hover:bg-bg">
                        <Pencil size={16} className="mr-2 inline" /> Alterar
                      </button>
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
          {tab === "Contratos" && (
            <Section title="Contratos">
              <div className="mb-3">
                <Button
                  onClick={() => {
                    setEditingContratoId(null);
                    setPlanoNome("");
                    setValor("");
                    setRecorrencia("");
                    setQtdAulas("");
                    setDataInicio("");
                    setHoraAula("");
                    setDiasSemana([]);
                    setContratoProfessorId("");
                    setMsgContrato("");
                    setOpenContrato(true);
                  }}
                >
                  Novo contrato
                </Button>
              </div>
              <div className="space-y-3">
                {data.contratos.map((c: any) => (
                  <Card key={c.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-semibold">{c.plano}</p>
                        <p className="text-sm text-muted">Inicio: {c.inicio} • Fim: {c.fim}</p>
                        {c.professor_nome ? <p className="text-sm text-muted">Professor: {c.professor_nome}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => abrirEdicaoContrato(c)} className="rounded-xl border border-border p-2 text-muted hover:bg-bg">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deletarContrato(c.id)} className="rounded-xl border border-border p-2 text-danger hover:bg-danger/10">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge tone="success">{c.status}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}
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
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione a unidade</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
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

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Professor</p>
          <select
            value={contratoProfessorId}
            onChange={(e) => setContratoProfessorId(e.target.value)}
            className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none"
          >
            <option value="">Selecione o professor</option>
            {professores.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Professor</p>
          <select value={reagendarProfessorId} onChange={(e) => setReagendarProfessorId(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione o professor</option>
            {professores.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <Input type="date" value={reagendarData} onChange={(e) => setReagendarData(e.target.value)} />
          <select value={reagendarHora} onChange={(e) => setReagendarHora(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione o horario</option>
            {horasCheias.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          {reagendarMsg && <p className="text-sm text-danger">{reagendarMsg}</p>}
          <Button className="w-full" onClick={salvarReagendamento} disabled={reagendarLoading}>
            {reagendarLoading ? "Salvando..." : "Salvar reagendamento"}
          </Button>
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

      <Modal open={openAulaAvulsa} onClose={() => setOpenAulaAvulsa(false)} title="+ Aula Avulsa">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Professor</p>
          <select value={avulsaProfessorId} onChange={(e) => { setAvulsaProfessorId(e.target.value); setAvulsaHora(""); }} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione</option>
            {professores.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Data</p>
          <Input type="date" value={avulsaData} onChange={(e) => { setAvulsaData(e.target.value); setAvulsaHora(""); }} />
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Horarios livres</p>
          <select value={avulsaHora} onChange={(e) => setAvulsaHora(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione</option>
            {(disponibilidadeAvulsa?.horarios_livres || []).map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Valor</p>
          <Input placeholder="Ex: 120,00" value={avulsaValor} onChange={(e) => setAvulsaValor(e.target.value)} />
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Categoria</p>
          <select value={avulsaCategoria} onChange={(e) => { setAvulsaCategoria(e.target.value); setAvulsaSubcategoria(""); }} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione</option>
            {categorias.filter((c: any) => c.status === "ativo").map((c: any) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Subcategoria</p>
          <select value={avulsaSubcategoria} onChange={(e) => setAvulsaSubcategoria(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione</option>
            {subcategoriasFiltradasAvulsa.filter((s: any) => s.status === "ativo").map((s: any) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
          </select>
          {avulsaMsg && <p className="text-sm text-danger">{avulsaMsg}</p>}
          <Button className="w-full" onClick={salvarAulaAvulsa}>Salvar aula avulsa</Button>
        </div>
      </Modal>

      <Modal open={openDesconto} onClose={() => (descontoLoading ? null : setOpenDesconto(false))} title="Descontar aula">
        <div className="space-y-3">
          <p className="text-sm text-muted">Iremos estornar o valor desta aula e abater do saldo em aberto do aluno.</p>

          {descontoValor !== null && (
            <div className="rounded-2xl bg-bg p-4 text-sm text-text">
              Valor calculado:{" "}
              <span className="font-semibold">
                {Number(descontoValor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          )}

          {descontoMsg && <p className="text-sm text-danger">{descontoMsg}</p>}

          <div className="flex items-center gap-2 pt-1">
            {descontoValor === null ? (
              <button
                type="button"
                disabled={descontoLoading}
                onClick={confirmarDesconto}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-soft disabled:opacity-60"
              >
                {descontoLoading ? "Descontando..." : "Descontar"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={cancelarAulaDescontada}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-danger text-sm font-semibold text-white shadow-soft"
                >
                  Sim, cancelar aula
                </button>
                <button
                  type="button"
                  onClick={() => setOpenDesconto(false)}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-white text-sm font-semibold text-text"
                >
                  Nao
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </main>
  );
}
