"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, CheckCircle2, CreditCard, PhoneOff, TrendingUp, Users, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Modal } from "@/components/ui/modal";
import { useAuthStore } from "@/store/auth";

type Kpi = { label: string; value: string };
type AgendaAula = {
  id: number;
  inicio: string;
  status: string;
  professor_nome: string;
  aluno_id?: number;
  unidade?: string;
  data_br?: string;
  hora_br?: string;
};
type ContaReceber = {
  id: number;
  aluno_id?: number;
  aluno_nome: string;
  plano_nome: string;
  valor: number;
  vencimento: string;
  status: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function iconFor(label: string) {
  const s = String(label || "").toLowerCase();
  if (s.includes("alunos")) return Users;
  if (s.includes("aulas")) return CalendarDays;
  if (s.includes("receb")) return TrendingUp;
  if (s.includes("receita") || s.includes("receber")) return CreditCard;
  return ArrowRight;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
  async function atualizarStatusAula(a: AgendaAula, status: "realizada" | "falta_aviso" | "falta") {
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

  const [pagarOpen, setPagarOpen] = useState(false);
  const [pagarConta, setPagarConta] = useState<ContaReceber | null>(null);
  const [dataPagamento, setDataPagamento] = useState(todayIso());
  const [paying, setPaying] = useState(false);

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
  const aulasHoje = (agendaHoje?.aulas || [])
    .filter((a) => String(a.status || "").toLowerCase() === "realizada")
    .slice(0, 6);
  const contasAbertas = (pendencias || []).slice(0, 6);

  return (
    <main className="space-y-5">
      <header className="flex items-center justify-between">
        <p className="text-sm text-muted">Painel</p>
      </header>

      <Section title={`Ola, ${nome}`} subtitle={role === "gestor" ? "Visao do gestor" : `Perfil ${role}`}>
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
                      <p className="mt-2 text-3xl font-semibold text-text">{k.value}</p>
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
              {!agendaLoading && aulasHoje.length === 0 && (
                <div className="rounded-2xl bg-bg p-4 text-sm text-muted">Sem aulas para hoje.</div>
              )}
              {!agendaLoading &&
                aulasHoje.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-2xl border border-border bg-white p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">{a.data_br || todayIso()} • {a.hora_br || "--:--"}</p>
                      <p className="truncate text-sm text-muted">{a.professor_nome} {a.unidade ? `• ${a.unidade}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingAula === a.id}
                        onClick={() => atualizarStatusAula(a, "realizada")}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-white text-success disabled:opacity-50"
                        aria-label="Marcar como realizada"
                        title="Realizada"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                      <button
                        type="button"
                        disabled={savingAula === a.id}
                        onClick={() => atualizarStatusAula(a, "falta_aviso")}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-white text-primary disabled:opacity-50"
                        aria-label="Marcar falta avisada"
                        title="Falta avisada"
                      >
                        <PhoneOff size={18} />
                      </button>
                      <button
                        type="button"
                        disabled={savingAula === a.id}
                        onClick={() => atualizarStatusAula(a, "falta")}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-white text-danger disabled:opacity-50"
                        aria-label="Marcar falta"
                        title="Falta"
                      >
                        <XCircle size={18} />
                      </button>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{a.status || "agendada"}</span>
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
              <Link href="/financeiro" className="text-sm font-semibold text-primary">
                Ver financeiro <ArrowRight className="ml-1 inline" size={16} />
              </Link>
            </div>
            <div className="space-y-2 px-4 pb-4">
              {pendLoading && <div className="h-24 animate-pulse rounded-2xl bg-bg" />}
              {!pendLoading && contasAbertas.length === 0 && (
                <div className="rounded-2xl bg-bg p-4 text-sm text-muted">Nenhuma conta em aberto.</div>
              )}
              {!pendLoading &&
                contasAbertas.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-text">{c.aluno_nome}</p>
                        <p className="truncate text-sm text-muted">{c.plano_nome || "Sem plano"} • Venc: {c.vencimento}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-text">
                          {Number(c.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                        <button
                          type="button"
                          onClick={() => abrirPagar(c)}
                          className="mt-2 inline-flex h-9 items-center rounded-2xl bg-success px-4 text-sm font-semibold text-white shadow-soft"
                        >
                          Pagar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Link href="/alunos/novo" className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-semibold text-white shadow-soft">
                  + Aluno
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
        </div>
      )}

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
