"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type Professor = { id: number; nome: string };
type AulaItem = { id: number; data_br: string; hora_br: string; aluno_nome: string; status: string; valor_por_aula: number };
type RelatorioResp = {
  professor_nome: string;
  valor_por_aula: number;
  quantidade_aulas: number;
  quantidade_realizadas: number;
  total_estimado: number;
  aulas: AulaItem[];
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function startOfWeekIso() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}
function startOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function toBRL(v: number) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<"mes" | "semana" | "custom">("mes");
  const [dataInicio, setDataInicio] = useState(startOfMonthIso());
  const [dataFim, setDataFim] = useState(isoToday());
  const [professorId, setProfessorId] = useState("");

  const profQ = useQuery<Professor[]>({
    queryKey: ["agenda-professores-rel"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/agenda/professores`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const relQ = useQuery<RelatorioResp | null>({
    queryKey: ["rel-qtd-aulas-prof", professorId, periodo, dataInicio, dataFim],
    queryFn: async () => {
      if (!professorId) return null;
      const qs = new URLSearchParams({ professor_id: professorId, periodo });
      if (periodo === "custom") {
        qs.set("data_inicio", dataInicio);
        qs.set("data_fim", dataFim);
      }
      const res = await fetch(`${API_URL}/relatorios/quantidade-aulas-professor?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Falha ao carregar relatorio");
      }
      return res.json();
    },
    enabled: !!professorId,
  });

  const linhas = useMemo(() => relQ.data?.aulas || [], [relQ.data]);

  function exportarExcel() {
    const header = ["Data", "Hora", "Aluno", "Status", "Valor por aula"];
    const body = linhas.map((a) =>
      [a.data_br, a.hora_br, a.aluno_nome, a.status, String(a.valor_por_aula || 0)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quantidade_aulas_professor_${isoToday()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportarPDF() {
    window.print();
  }

  return (
    <main className="space-y-4">
      <Section title="Relatorios" subtitle="Quantidade Aula Professor">
        <div className="grid gap-3 sm:grid-cols-3">
          <select value={professorId} onChange={(e) => setProfessorId(e.target.value)} className="h-12 rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Professor</option>
            {(profQ.data || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as any)} className="h-12 rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="mes">Mes</option>
            <option value="semana">Semana</option>
            <option value="custom">Dia inicio e dia fim</option>
          </select>
          <div className="flex items-center gap-2">
            <button onClick={exportarExcel} className="rounded-xl border border-border px-3 py-2 text-sm text-text">Excel</button>
            <button onClick={exportarPDF} className="rounded-xl border border-border px-3 py-2 text-sm text-text">PDF</button>
          </div>
        </div>
        {periodo === "custom" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        )}
      </Section>
      {relQ.isError && (
        <Card className="p-4 text-sm text-danger">{(relQ.error as Error)?.message || "Falha ao carregar relatorio."}</Card>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted">Professor</p>
          <p className="text-base font-semibold">{relQ.data?.professor_nome || "--"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Qtd Aulas</p>
          <p className="text-2xl font-semibold">{relQ.data?.quantidade_aulas || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Valor por aula</p>
          <p className="text-2xl font-semibold">{toBRL(relQ.data?.valor_por_aula || 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Total estimado</p>
          <p className="text-2xl font-semibold">{toBRL(relQ.data?.total_estimado || 0)}</p>
        </Card>
      </div>

      <Card className="space-y-2 p-4">
        {linhas.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-2xl border border-border p-3">
            <div>
              <p className="font-semibold text-text">{a.aluno_nome}</p>
              <p className="text-sm text-muted">{a.data_br} • {a.hora_br} • {a.status}</p>
            </div>
            <p className="text-sm font-semibold text-text">{toBRL(a.valor_por_aula || 0)}</p>
          </div>
        ))}
        {linhas.length === 0 && <p className="text-sm text-muted">Sem dados para o filtro selecionado.</p>}
      </Card>
    </main>
  );
}
