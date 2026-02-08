"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Lock, MinusCircle, PhoneCall, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAuthStore } from "@/store/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const horas = Array.from({ length: 15 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

type Professor = { id: number; usuario_id: number; nome: string };
type AulaApi = {
  id: number;
  inicio: string;
  fim: string;
  status: string;
  professor_id: number;
  professor_nome: string;
  unidade: string;
  aluno_id?: number;
};
type BloqueioApi = {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  motivo: string;
  profissional_id?: number | null;
  professor_nome?: string;
};
type MeResponse = { id: number; nome: string; role: "gestor" | "professor" | "aluno" };

function addDays(baseIso: string, daysToAdd: number): string {
  const d = new Date(`${baseIso}T00:00:00`);
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().slice(0, 10);
}

function startOfWeekIso(baseIso: string): string {
  const d = new Date(`${baseIso}T00:00:00`);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function startOfMonthIso(baseIso: string): string {
  const d = new Date(`${baseIso}T00:00:00`);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function daysInMonth(baseIso: string): number {
  const d = new Date(`${baseIso}T00:00:00`);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function statusMeta(statusRaw: string) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "realizada") return { label: "Realizada", tone: "success" as const, dot: "bg-success", icon: CheckCircle2 };
  if (s === "falta_aviso") return { label: "Falta avisada", tone: "default" as const, dot: "bg-primary", icon: PhoneCall };
  if (s === "falta") return { label: "Falta", tone: "danger" as const, dot: "bg-danger", icon: MinusCircle };
  if (s === "cancelada") return { label: "Cancelada", tone: "danger" as const, dot: "bg-danger", icon: MinusCircle };
  return { label: "Agendada", tone: "default" as const, dot: "bg-primary", icon: CalendarDays };
}

export default function AgendaPage() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const [modo, setModo] = useState<"dia" | "semana" | "mes">("dia");
  const [dataRef, setDataRef] = useState(new Date().toISOString().slice(0, 10));
  const [professorId, setProfessorId] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [openBloqueio, setOpenBloqueio] = useState(false);
  const [bloqInicio, setBloqInicio] = useState(new Date().toISOString().slice(0, 10));
  const [bloqFim, setBloqFim] = useState(new Date().toISOString().slice(0, 10));
  const [bloqHoraInicio, setBloqHoraInicio] = useState("18:00");
  const [bloqHoraFim, setBloqHoraFim] = useState("19:00");
  const [bloqMotivo, setBloqMotivo] = useState("");
  const [bloqDias, setBloqDias] = useState<string[]>([]);

  const { data: me } = useQuery<MeResponse | null>({
    queryKey: ["auth-me-agenda"],
    queryFn: async () => {
      if (!token) return null;
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!token,
  });

  const { data: professores = [] } = useQuery<Professor[]>({
    queryKey: ["agenda-professores"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/agenda/professores`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (professorId !== "todos") return;
    if (!me || me.role !== "professor") return;
    const prof = professores.find((p) => p.usuario_id === me.id);
    if (prof) setProfessorId(String(prof.id));
  }, [me, professores, professorId]);

  const { data, isLoading } = useQuery<{ aulas: AulaApi[]; bloqueios: BloqueioApi[] }>({
    queryKey: ["agenda-v2", modo, dataRef, professorId],
    queryFn: async () => {
      let ini = dataRef;
      let fim = dataRef;
      if (modo === "semana") {
        ini = startOfWeekIso(dataRef);
        fim = addDays(ini, 6);
      } else if (modo === "mes") {
        ini = startOfMonthIso(dataRef);
        fim = addDays(ini, daysInMonth(dataRef) - 1);
      }

      const qs = new URLSearchParams({ data_inicio: ini, data_fim: fim });
      if (professorId !== "todos") qs.set("profissional_id", professorId);
      const res = await fetch(`${API_URL}/agenda/periodo?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) return { aulas: [], bloqueios: [] };
      const body = await res.json();
      return {
        aulas: (body.aulas || []).sort((a: AulaApi, b: AulaApi) => String(a.inicio).localeCompare(String(b.inicio))),
        bloqueios: (body.bloqueios || []).sort((a: BloqueioApi, b: BloqueioApi) =>
          `${a.data} ${a.hora_inicio}`.localeCompare(`${b.data} ${b.hora_inicio}`)
        ),
      };
    },
  });

  const cardsAulas = useMemo(() => {
    const all = data?.aulas || [];
    if (!busca.trim()) return all;
    const q = busca.toLowerCase();
    return all.filter((a) => a.professor_nome?.toLowerCase().includes(q) || a.unidade?.toLowerCase().includes(q));
  }, [data, busca]);

  async function marcarStatus(aula: AulaApi, status: "realizada" | "falta_aviso" | "falta" | "agendada") {
    const alunoId = aula.aluno_id;
    if (!alunoId) return;
    const res = await fetch(`${API_URL}/alunos/${alunoId}/aulas/${aula.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    qc.invalidateQueries({ queryKey: ["agenda-v2"] });
    qc.invalidateQueries({ queryKey: ["aluno-ficha", String(alunoId)] });
  }

  function toggleDia(dia: string) {
    setBloqDias((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]));
  }

  async function salvarBloqueio() {
    const payload = {
      data_inicio: bloqInicio,
      data_fim: bloqFim,
      hora_inicio: bloqHoraInicio,
      hora_fim: bloqHoraFim,
      motivo: bloqMotivo || null,
      profissional_id: professorId === "todos" ? null : Number(professorId),
      dias_semana: bloqDias,
    };
    const res = await fetch(`${API_URL}/agenda/bloqueios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    setOpenBloqueio(false);
    setBloqMotivo("");
    setBloqDias([]);
    qc.invalidateQueries({ queryKey: ["agenda-v2"] });
  }

  async function apagarBloqueio(id: number) {
    const res = await fetch(`${API_URL}/agenda/bloqueios/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    qc.invalidateQueries({ queryKey: ["agenda-v2"] });
  }

  return (
    <main className="space-y-4">
      <Section title="Agenda" subtitle="Dia, semana e mes por professor">
        <div className="grid gap-2 lg:grid-cols-12">
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <button
              onClick={() => setModo("dia")}
              className={`h-12 rounded-2xl px-4 text-sm ${modo === "dia" ? "bg-primary text-white" : "border border-border bg-white text-text"}`}
            >
              Dia
            </button>
            <button
              onClick={() => setModo("semana")}
              className={`h-12 rounded-2xl px-4 text-sm ${modo === "semana" ? "bg-primary text-white" : "border border-border bg-white text-text"}`}
            >
              Semana
            </button>
            <button
              onClick={() => setModo("mes")}
              className={`h-12 rounded-2xl px-4 text-sm ${modo === "mes" ? "bg-primary text-white" : "border border-border bg-white text-text"}`}
            >
              Mês
            </button>
          </div>

          <div className="lg:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted" />
              <Input className="h-12 pl-11" placeholder="Buscar por professor ou unidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>

          <Input type="date" className="h-12 lg:col-span-2" value={dataRef} onChange={(e) => setDataRef(e.target.value)} />

          <select
            className="h-12 rounded-2xl border border-border bg-white px-4 text-text outline-none lg:col-span-2"
            value={professorId}
            onChange={(e) => setProfessorId(e.target.value)}
          >
            <option value="todos">Todos os professores</option>
            {professores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          <div className="lg:col-span-1">
            <Button className="h-12 w-full px-3" onClick={() => setOpenBloqueio(true)}>
              <Lock size={14} className="mr-2" /> Bloquear
            </Button>
          </div>
        </div>
      </Section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-muted">Aulas</p><p className="text-2xl font-semibold text-text">{data?.aulas?.length || 0}</p></Card>
        <Card><p className="text-sm text-muted">Bloqueios</p><p className="text-2xl font-semibold text-text">{data?.bloqueios?.length || 0}</p></Card>
        <Card><p className="text-sm text-muted">Período</p><p className="text-2xl font-semibold text-success">{modo === "dia" ? "Dia" : modo === "semana" ? "Semana" : "Mês"}</p></Card>
      </div>

      <div className="space-y-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-20 animate-pulse" />)}
        {!isLoading && (data?.bloqueios || []).map((b) => (
          <Card key={`b-${b.id}`} className="flex items-center justify-between border border-danger/20 bg-danger/5 p-4">
            <div>
              <p className="text-sm font-semibold text-danger">Bloqueio {b.data} - {b.hora_inicio} - {b.hora_fim}</p>
              <p className="text-xs text-muted">{b.professor_nome || "Todos"} - {b.motivo || "Sem motivo"}</p>
            </div>
            <button className="rounded-xl border border-border px-3 py-1 text-sm text-danger" onClick={() => apagarBloqueio(b.id)}>Excluir</button>
          </Card>
        ))}
        {!isLoading && cardsAulas.map((a) => (
          <Card key={a.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-primary">
                {a.inicio ? new Date(a.inicio).toLocaleDateString("pt-BR") : "--"} -{" "}
                {a.inicio ? new Date(a.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--"}
              </p>
              <p className="truncate font-medium">{a.professor_nome}</p>
              <p className="truncate text-sm text-muted">{a.unidade}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-1 sm:flex">
                <button
                  title="Marcar como realizada"
                  onClick={() => marcarStatus(a, "realizada")}
                  className="rounded-xl border border-border p-2 text-success hover:bg-success/10"
                >
                  <CheckCircle2 size={16} />
                </button>
                <button
                  title="Marcar falta avisada"
                  onClick={() => marcarStatus(a, "falta_aviso")}
                  className="rounded-xl border border-border p-2 text-primary hover:bg-primary/10"
                >
                  <PhoneCall size={16} />
                </button>
                <button
                  title="Marcar falta"
                  onClick={() => marcarStatus(a, "falta")}
                  className="rounded-xl border border-border p-2 text-danger hover:bg-danger/10"
                >
                  <MinusCircle size={16} />
                </button>
              </div>
              <Badge tone={statusMeta(a.status).tone}>{statusMeta(a.status).label}</Badge>
            </div>
          </Card>
        ))}
        {!isLoading && (data?.aulas?.length || 0) === 0 && (
          <Card className="p-5 text-sm text-muted">Nenhuma aula encontrada para o filtro atual.</Card>
        )}
      </div>

      <Modal open={openBloqueio} onClose={() => setOpenBloqueio(false)} title="Bloqueio de Agenda">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input type="date" value={bloqInicio} onChange={(e) => setBloqInicio(e.target.value)} />
            <Input type="date" value={bloqFim} onChange={(e) => setBloqFim(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="h-12 rounded-2xl border border-border bg-white px-4 text-text outline-none" value={bloqHoraInicio} onChange={(e) => setBloqHoraInicio(e.target.value)}>
              {horas.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <select className="h-12 rounded-2xl border border-border bg-white px-4 text-text outline-none" value={bloqHoraFim} onChange={(e) => setBloqHoraFim(e.target.value)}>
              {horas.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {dias.map((d) => (
              <button key={d} onClick={() => toggleDia(d)} className={`rounded-xl px-3 py-2 text-sm ${bloqDias.includes(d) ? "bg-primary text-white" : "border border-border text-text"}`}>
                {d}
              </button>
            ))}
          </div>
          <Input placeholder="Motivo (opcional)" value={bloqMotivo} onChange={(e) => setBloqMotivo(e.target.value)} />
          <Button className="h-11 w-full" onClick={salvarBloqueio}>
            <CalendarDays size={14} className="mr-2" /> Salvar bloqueio
          </Button>
        </div>
      </Modal>
    </main>
  );
}
