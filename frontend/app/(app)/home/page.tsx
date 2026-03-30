"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, CheckCircle2, CreditCard, Eye, EyeOff, MinusCircle, Pencil, PhoneCall, TrendingUp, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Modal } from "@/components/ui/modal";
import { useAuthStore } from "@/store/auth";

type Kpi = { label: string; value: string };
type AgendaAula = {
  id: number;
  inicio: string;
  status: string;
  aluno_nome?: string;
  professor_nome: string;
  professor_id?: number;
  aluno_id?: number;
  unidade?: string;
  data_br?: string;
  hora_br?: string;
};
type Professor = { id: number; usuario_id: number; nome: string };
type ContaReceber = {
  id: number;
  aluno_id?: number;
  aluno_nome: string;
  plano_nome: string;
  valor: number;
  vencimento: string;
  status: string;
  aulas_pendentes?: number | null;
};

type ContaReceberAgg = {
  aluno_id?: number;
  aluno_nome: string;
  total: number;
  qtd: number;
  qtd_pendencias_aulas?: number | null;
  proximo_vencimento: string;
  proxima_conta: ContaReceber;
};

type AgendaGrupo = {
  key: string;
  data_br: string;
  hora_br: string;
  professor_nome: string;
  unidade: string;
  aulas: AgendaAula[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const horas = Array.from({ length: 29 }, (_, i) => {
  const totalMin = 7 * 60 + i * 30;
  const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const mm = String(totalMin % 60).padStart(2, "0");
  return `${hh}:${mm}`;
});

function iconFor(label: string) {
  const s = String(label || "").toLowerCase();
  if (s.includes("alunos")) return Users;
  if (s.includes("aulas")) return CalendarDays;
  if (s.includes("receb")) return TrendingUp;
  if (s.includes("receita") || s.includes("receber")) return CreditCard;
  return ArrowRight;
}

function isCurrencyLabel(label: string) {
  const s = String(label || "").toLowerCase();
  return s.includes("receita") || s.includes("receb") || s.includes("a receber") || s.includes("fatur");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function brDateToEpoch(d: string) {
  const s = String(d || "").trim();
  // Accepts DD/MM/YYYY or YYYY-MM-DD; falls back to 0.
  if (!s) return 0;
  if (s.includes("/")) {
    const [dd, mm, yyyy] = s.split("/");
    const y = Number(yyyy);
    const m = Number(mm);
    const day = Number(dd);
    if (!y || !m || !day) return 0;
    return Date.UTC(y, m - 1, day);
  }
  const iso = s.slice(0, 10);
  const [yyyy, mm, dd] = iso.split("-");
  const y = Number(yyyy);
  const m = Number(mm);
  const day = Number(dd);
  if (!y || !m || !day) return 0;
  return Date.UTC(y, m - 1, day);
}

function statusMeta(statusRaw: string) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "realizada") return { label: "Realizada", tone: "success" as const };
  if (s === "falta_aviso") return { label: "Falta avisada", tone: "default" as const };
  if (s === "falta") return { label: "Falta", tone: "danger" as const };
  if (s === "cancelada") return { label: "Cancelada", tone: "danger" as const };
  return { label: "Agendada", tone: "default" as const };
}

export default function HomePage() {
  const role = useAuthStore((s) => s.role) || "gestor";
  const nome = useAuthStore((s) => s.nome) || "Visitante";
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const { data, isLoading } = useQuery<{ kpis: Kpi[] }>({
    queryKey: ["home-kpis", role],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/home/kpis`, {
        headers: authHeaders,
        cache: "no-store",
      });
      if (!res.ok) return { kpis: [] };
      return res.json();
    },
    enabled: !!token,
  });

  const { data: agendaHoje, isLoading: agendaLoading } = useQuery<{ aulas: AgendaAula[] }>({
    queryKey: ["home-agenda-hoje"],
    queryFn: async () => {
      const d = todayIso();
      const qs = new URLSearchParams({ data_inicio: d, data_fim: d, _ts: String(Date.now()) });
      const res = await fetch(`${API_URL}/agenda/periodo?${qs.toString()}`, { cache: "no-store", headers: authHeaders });
      if (!res.ok) return { aulas: [] };
      const body = await res.json();
      return { aulas: (body.aulas || []) as AgendaAula[] };
    },
    enabled: !!token && role === "gestor",
  });

  const { data: professores = [] } = useQuery<Professor[]>({
    queryKey: ["agenda-professores-home"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/agenda/professores`, { cache: "no-store", headers: authHeaders });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && role === "gestor",
  });

  const { data: pendencias, isLoading: pendLoading } = useQuery<ContaReceber[]>({
    queryKey: ["home-contas-receber-aberto"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/contas-receber?status=aberto`, { cache: "no-store", headers: authHeaders });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && role === "gestor",
  });

  const [savingAula, setSavingAula] = useState<number | null>(null);
  async function atualizarStatusAula(a: AgendaAula, status: "realizada" | "falta_aviso" | "falta" | "cancelada") {
    if (!a.aluno_id) return;
    setSavingAula(a.id);
    try {
      const res = await fetch(`${API_URL}/alunos/${a.aluno_id}/aulas/${a.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(authHeaders || {}) },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      await qc.invalidateQueries({ queryKey: ["home-agenda-hoje"] });
      await qc.invalidateQueries({ queryKey: ["home-kpis"] });
    } finally {
      setSavingAula(null);
    }
  }

  const [openEditar, setOpenEditar] = useState(false);
  const [aulaEditId, setAulaEditId] = useState<number | null>(null);
  const [aulaEditAlunoId, setAulaEditAlunoId] = useState<number | null>(null);
  const [aulaEditData, setAulaEditData] = useState("");
  const [aulaEditHora, setAulaEditHora] = useState("");
  const [aulaEditProfessorId, setAulaEditProfessorId] = useState("");
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  function abrirEditarAula(aula: AgendaAula) {
    setAulaEditId(aula.id);
    setAulaEditAlunoId(aula.aluno_id || null);
    setAulaEditProfessorId(aula.professor_id ? String(aula.professor_id) : (professores[0]?.id ? String(professores[0].id) : ""));
    const baseData = aula.data_br;
    if (baseData && baseData.includes("/")) {
      const [dd, mm, yyyy] = baseData.split("/");
      setAulaEditData(dd && mm && yyyy ? `${yyyy}-${mm}-${dd}` : todayIso());
    } else {
      setAulaEditData(todayIso());
    }
    setAulaEditHora(aula.hora_br || "");
    setEditMsg(null);
    setOpenEditar(true);
  }

  async function salvarEditarAula() {
    if (!aulaEditId || !aulaEditAlunoId) {
      setEditMsg("Esta aula nao possui aluno vinculado para editar.");
      return;
    }
    if (!aulaEditProfessorId || !aulaEditData || !aulaEditHora) {
      setEditMsg("Preencha professor, data e horario.");
      return;
    }

    setEditLoading(true);
    setEditMsg(null);
    try {
      const res = await fetch(`${API_URL}/alunos/${aulaEditAlunoId}/aulas/${aulaEditId}/reagendar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(authHeaders || {}) },
        body: JSON.stringify({
          data: aulaEditData,
          hora: aulaEditHora,
          professor_id: Number(aulaEditProfessorId),
        }),
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        setEditMsg(erro.detail || "Falha ao salvar.");
        return;
      }

      setOpenEditar(false);
      await qc.invalidateQueries({ queryKey: ["home-agenda-hoje"] });
      await qc.invalidateQueries({ queryKey: ["home-kpis"] });
      await qc.invalidateQueries({ queryKey: ["agenda-v2"] });
    } catch {
      setEditMsg("Falha de rede ao salvar. Tente novamente.");
    } finally {
      setEditLoading(false);
    }
  }

  const [pagarOpen, setPagarOpen] = useState(false);
  const [pagarConta, setPagarConta] = useState<ContaReceber | null>(null);
  const [dataPagamento, setDataPagamento] = useState(todayIso());
  const [paying, setPaying] = useState(false);
  const [mostrarKpis, setMostrarKpis] = useState(false);
  const [mostrarValoresPendencias, setMostrarValoresPendencias] = useState(false);

  function abrirPagar(c: ContaReceber) {
    setPagarConta(c);
    setDataPagamento(todayIso());
    setPagarOpen(true);
  }

  async function confirmarPagamento() {
    if (!pagarConta) return;
    setPaying(true);
    try {
      const res = await fetch(`${API_URL}/contas-receber/${pagarConta.id}/pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeaders || {}) },
        body: JSON.stringify({ data_pagamento: dataPagamento }),
      });
      if (!res.ok) return;
      setPagarOpen(false);
      setPagarConta(null);
      await qc.invalidateQueries({ queryKey: ["home-contas-receber-aberto"] });
      await qc.invalidateQueries({ queryKey: ["home-kpis"] });
    } finally {
      setPaying(false);
    }
  }

  const kpis = data?.kpis || [];
  const aulasHoje = (agendaHoje?.aulas || []).filter((a) => String(a.status || "").toLowerCase() !== "realizada");

  const gruposAgenda = useMemo(() => {
    const grupos = new Map<string, AgendaGrupo>();
    for (const a of aulasHoje) {
      const dataBr = a.data_br || todayIso();
      const horaBr = a.hora_br || "--:--";
      const unidade = a.unidade || "";
      const professor = a.professor_nome || "Sem professor";
      const key = `${dataBr}|${horaBr}|${unidade}`;
      const existente = grupos.get(key);
      if (!existente) {
        grupos.set(key, {
          key,
          data_br: dataBr,
          hora_br: horaBr,
          professor_nome: professor,
          unidade,
          aulas: [a],
        });
        continue;
      }
      existente.aulas.push(a);
    }
    return Array.from(grupos.values()).slice(0, 6);
  }, [aulasHoje]);

  const contasAbertasPorAluno = useMemo(() => {
    const m = new Map<string, ContaReceberAgg>();
    for (const c of pendencias || []) {
      const key = c.aluno_id ? `id:${c.aluno_id}` : `nome:${String(c.aluno_nome || "").toLowerCase()}`;
      const existing = m.get(key);
      if (!existing) {
        m.set(key, {
          aluno_id: c.aluno_id,
          aluno_nome: c.aluno_nome,
          total: Number(c.valor || 0),
          qtd: 1,
          qtd_pendencias_aulas: c.aulas_pendentes ?? null,
          proximo_vencimento: c.vencimento,
          proxima_conta: c,
        });
        continue;
      }
      existing.total += Number(c.valor || 0);
      existing.qtd += 1;
      if (existing.qtd_pendencias_aulas == null && c.aulas_pendentes != null) {
        existing.qtd_pendencias_aulas = c.aulas_pendentes;
      }

      if (brDateToEpoch(c.vencimento) && brDateToEpoch(c.vencimento) < brDateToEpoch(existing.proximo_vencimento)) {
        existing.proximo_vencimento = c.vencimento;
        existing.proxima_conta = c;
      }
    }
    return Array.from(m.values()).sort((a, b) => {
      const da = brDateToEpoch(a.proximo_vencimento);
      const db = brDateToEpoch(b.proximo_vencimento);
      if (da !== db) return da - db;
      return b.total - a.total;
    });
  }, [pendencias]);

  const contasAbertas = contasAbertasPorAluno;

  return (
    <main className="space-y-5">
      <header className="flex items-center justify-between">
        <p className="text-sm text-muted">Painel</p>
      </header>

      <Section title={`Ola, ${nome}`} subtitle={role === "gestor" ? "Visao do gestor" : `Perfil ${role}`}>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setMostrarKpis((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-white text-muted"
            aria-label={mostrarKpis ? "Ocultar valores do resumo" : "Mostrar valores do resumo"}
            title={mostrarKpis ? "Ocultar valores do resumo" : "Mostrar valores do resumo"}
          >
            {mostrarKpis ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-24 animate-pulse" />)}
          {!isLoading &&
            kpis.map((k) => {
              const Icon = iconFor(k.label);
              return (
                <Card key={k.label} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted">{k.label}</p>
                      <p className="mt-2 text-3xl font-semibold text-text">
                        {mostrarKpis
                          ? k.value
                          : isCurrencyLabel(k.label)
                            ? "R$ ••••••"
                            : "••"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                      <Icon size={18} />
                    </div>
                  </div>
                </Card>
              );
            })}
          {!isLoading && kpis.length === 0 && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Resumo</p>
              <p className="mt-2 text-sm text-muted">Sem dados ainda para este perfil.</p>
            </Card>
          )}
        </div>
      </Section>

      {role === "gestor" && (
        <div className="grid gap-3 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Hoje</p>
                <p className="text-lg font-semibold text-text">Agenda</p>
              </div>
              <Link href="/agenda" className="text-sm font-semibold text-primary">
                Ver agenda <ArrowRight className="ml-1 inline" size={16} />
              </Link>
            </div>
            <div className="space-y-2 px-4 pb-4">
              {agendaLoading && <div className="h-24 animate-pulse rounded-2xl bg-bg" />}
              {!agendaLoading && gruposAgenda.length === 0 && (
                <div className="rounded-2xl bg-bg p-4 text-sm text-muted">Sem aulas para hoje.</div>
              )}
              {!agendaLoading &&
                gruposAgenda.map((g) => (
                  <div key={g.key} className="rounded-2xl border border-border bg-white p-4">
                    <p className="text-sm text-muted">{g.data_br} • {g.hora_br}</p>
                    <p className="truncate text-sm text-muted">{g.professor_nome} {g.unidade ? `• ${g.unidade}` : ""}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {g.aulas.map((a) => (
                        <div key={a.id} className="rounded-xl border border-border p-3">
                          <p className="truncate text-sm font-semibold text-text">{a.aluno_nome || "Aluno nao informado"}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEditarAula(a)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white text-text"
                              aria-label="Alterar aula"
                              title="Alterar aula"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={savingAula === a.id}
                              onClick={() => atualizarStatusAula(a, "realizada")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white text-success disabled:opacity-50"
                              aria-label="Marcar como realizada"
                              title="Realizada"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={savingAula === a.id}
                              onClick={() => atualizarStatusAula(a, "falta_aviso")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white text-primary disabled:opacity-50"
                              aria-label="Marcar falta avisada"
                              title="Falta avisada"
                            >
                              <PhoneCall size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={savingAula === a.id}
                              onClick={() => atualizarStatusAula(a, "falta")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white text-danger disabled:opacity-50"
                              aria-label="Marcar falta"
                              title="Falta"
                            >
                              <MinusCircle size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={savingAula === a.id}
                              onClick={() => atualizarStatusAula(a, "cancelada")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white text-danger disabled:opacity-50"
                              aria-label="Marcar cancelada"
                              title="Cancelada"
                            >
                              <XCircle size={16} />
                            </button>
                            <Badge tone={statusMeta(a.status).tone}>{statusMeta(a.status).label}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          <Card className="lg:col-span-5">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Pendencias</p>
                <p className="text-lg font-semibold text-text">Contas a Receber</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMostrarValoresPendencias((v) => !v)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-white text-muted"
                  aria-label={mostrarValoresPendencias ? "Ocultar valores" : "Mostrar valores"}
                  title={mostrarValoresPendencias ? "Ocultar valores" : "Mostrar valores"}
                >
                  {mostrarValoresPendencias ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <Link href="/financeiro" className="text-sm font-semibold text-primary">
                  Ver financeiro <ArrowRight className="ml-1 inline" size={16} />
                </Link>
              </div>
            </div>
            <div className="px-4 pb-4">
              {pendLoading && <div className="h-24 animate-pulse rounded-2xl bg-bg" />}
              {!pendLoading && contasAbertas.length === 0 && (
                <div className="rounded-2xl bg-bg p-4 text-sm text-muted">Nenhuma conta em aberto.</div>
              )}

              {!pendLoading && contasAbertas.length > 0 && (
                <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                  {contasAbertas.map((c) => (
                    <div key={c.aluno_id || c.aluno_nome} className="rounded-2xl border border-border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-text">{c.aluno_nome}</p>
                          <p className="truncate text-sm text-muted">
                            {(c.qtd_pendencias_aulas ?? c.qtd)} em aberto • Próx: {c.proximo_vencimento}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-text">
                            {mostrarValoresPendencias
                              ? Number(c.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                              : "R$ ••••••"}
                          </p>
                          <button
                            type="button"
                            onClick={() => abrirPagar(c.proxima_conta)}
                            className="mt-2 inline-flex h-9 items-center rounded-2xl bg-success px-4 text-sm font-semibold text-white shadow-soft"
                          >
                            Pagar próxima
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Link href="/alunos/novo" className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-semibold text-white shadow-soft">
                  + Aluno
                </Link>
                <Link href="/aulas-avulsas" className="inline-flex h-11 items-center rounded-2xl border border-border bg-white px-5 text-sm font-semibold text-text">
                  + Aula avulsa
                </Link>
                <Link href="/configuracoes?entidade=planos" className="inline-flex h-11 items-center rounded-2xl border border-border bg-white px-5 text-sm font-semibold text-text">
                  + Plano
                </Link>
              </div>
            </div>
          </Card>
        </div>
      )}

      {role !== "gestor" && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/alunos" className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-semibold text-white shadow-soft">
            Ver alunos
          </Link>
          <Link href="/aulas-avulsas" className="inline-flex h-11 items-center rounded-2xl border border-border bg-white px-5 text-sm font-semibold text-text">
            Aula avulsa
          </Link>
        </div>
      )}

      <Modal
        open={openEditar}
        title="Alterar aula"
        onClose={() => {
          if (editLoading) return;
          setOpenEditar(false);
        }}
      >
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Professor</span>
            <select
              value={aulaEditProfessorId}
              onChange={(e) => setAulaEditProfessorId(e.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-text outline-none"
            >
              <option value="">Selecione o professor</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Data</span>
            <input
              type="date"
              value={aulaEditData}
              onChange={(e) => setAulaEditData(e.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Horario</span>
            <select
              value={aulaEditHora}
              onChange={(e) => setAulaEditHora(e.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-text outline-none"
            >
              <option value="">Selecione</option>
              {horas.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>

          {editMsg && <p className="text-sm text-danger">{editMsg}</p>}

          <button
            type="button"
            disabled={editLoading}
            onClick={salvarEditarAula}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-soft disabled:opacity-60"
          >
            {editLoading ? "Salvando..." : "Salvar alteracoes"}
          </button>
        </div>
      </Modal>

      <Modal
        open={pagarOpen}
        title="Dar baixa (Conta a Receber)"
        onClose={() => {
          if (paying) return;
          setPagarOpen(false);
        }}
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-text">{pagarConta?.aluno_nome || ""}</p>
            <p className="text-sm text-muted">{pagarConta?.plano_nome || "Sem plano"}</p>
          </div>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Data de pagamento</span>
            <input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <button
            type="button"
            disabled={paying}
            onClick={confirmarPagamento}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-soft disabled:opacity-60"
          >
            {paying ? "Pagando..." : "Confirmar pagamento"}
          </button>
        </div>
      </Modal>
    </main>
  );
}
