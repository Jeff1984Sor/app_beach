"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { exportReportExcel, exportReportPdf } from "@/lib/report-export";

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
  const [mesSelecionado, setMesSelecionado] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [dataInicio, setDataInicio] = useState(startOfMonthIso());
  const [dataFim, setDataFim] = useState(isoToday());
  const [professorId, setProfessorId] = useState("");
  const mesesAno = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Marco" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  const profQ = useQuery<Professor[]>({
    queryKey: ["agenda-professores-rel"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/agenda/professores`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const relQ = useQuery<RelatorioResp | null>({
    queryKey: ["rel-qtd-aulas-prof", professorId, periodo, mesSelecionado, dataInicio, dataFim],
    queryFn: async () => {
      if (!professorId) return null;
      const qs = new URLSearchParams({ professor_id: professorId, periodo });
      if (periodo === "mes") {
        const anoAtual = new Date().getFullYear();
        const inicio = `${anoAtual}-${mesSelecionado}-01`;
        const ultimoDia = new Date(anoAtual, Number(mesSelecionado), 0).getDate();
        const fim = `${anoAtual}-${mesSelecionado}-${String(ultimoDia).padStart(2, "0")}`;
        qs.set("periodo", "custom");
        qs.set("data_inicio", inicio);
        qs.set("data_fim", fim);
      } else if (periodo === "custom") {
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
    exportReportExcel({
      fileBaseName: "relatorio_quantidade_aulas_professor",
      title: "Relatorio - Quantidade Aula Professor",
      subtitle: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
      filters: [
        `Professor: ${relQ.data?.professor_nome || "Nao selecionado"}`,
        `Periodo: ${periodo === "mes" ? "mes" : periodo}`,
        periodo === "mes" ? `Mes: ${mesesAno.find((m) => m.value === mesSelecionado)?.label || mesSelecionado}` : "",
        periodo === "custom" ? `${dataInicio} ate ${dataFim}` : "",
      ].filter(Boolean),
      summary: [
        { label: "Qtd aulas", value: String(relQ.data?.quantidade_aulas || 0) },
        { label: "Valor por aula", value: toBRL(relQ.data?.valor_por_aula || 0) },
        { label: "Total estimado", value: toBRL(relQ.data?.total_estimado || 0) },
      ],
      columns: [
        { header: "Data", key: "data_br" },
        { header: "Hora", key: "hora_br" },
        { header: "Aluno", key: "aluno_nome" },
        { header: "Status", key: "status" },
        { header: "Valor por aula", key: "valor_por_aula" },
      ],
      rows: linhas.map((a) => ({
        data_br: a.data_br,
        hora_br: a.hora_br,
        aluno_nome: a.aluno_nome,
        status: a.status,
        valor_por_aula: toBRL(a.valor_por_aula || 0),
      })),
    });
  }

  function exportarPDF() {
    exportReportPdf({
      fileBaseName: "relatorio_quantidade_aulas_professor",
      title: "Relatorio - Quantidade Aula Professor",
      subtitle: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
      filters: [
        `Professor: ${relQ.data?.professor_nome || "Nao selecionado"}`,
        `Periodo: ${periodo === "mes" ? "mes" : periodo}`,
        periodo === "mes" ? `Mes: ${mesesAno.find((m) => m.value === mesSelecionado)?.label || mesSelecionado}` : "",
        periodo === "custom" ? `${dataInicio} ate ${dataFim}` : "",
      ].filter(Boolean),
      summary: [
        { label: "Qtd aulas", value: String(relQ.data?.quantidade_aulas || 0) },
        { label: "Valor por aula", value: toBRL(relQ.data?.valor_por_aula || 0) },
        { label: "Total estimado", value: toBRL(relQ.data?.total_estimado || 0) },
      ],
      columns: [
        { header: "Data", key: "data_br" },
        { header: "Hora", key: "hora_br" },
        { header: "Aluno", key: "aluno_nome" },
        { header: "Status", key: "status" },
        { header: "Valor por aula", key: "valor_por_aula" },
      ],
      rows: linhas.map((a) => ({
        data_br: a.data_br,
        hora_br: a.hora_br,
        aluno_nome: a.aluno_nome,
        status: a.status,
        valor_por_aula: toBRL(a.valor_por_aula || 0),
      })),
    });
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
        {periodo === "mes" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="h-12 rounded-2xl border border-border bg-white px-4 text-text outline-none">
              {mesesAno.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        )}
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
            <div className="text-right">
              <p className="text-xs text-muted">Valor por aula</p>
              <p className="text-sm font-semibold text-text">{toBRL(a.valor_por_aula || 0)}</p>
            </div>
          </div>
        ))}
        {linhas.length === 0 && <p className="text-sm text-muted">Sem dados para o filtro selecionado.</p>}
      </Card>
    </main>
  );
}
