"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type AlunoItem = {
  id: number;
  nome: string;
  unidade?: string;
  status?: "ativo" | "inativo";
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AulaAvulsaHomePage() {
  const [alunoId, setAlunoId] = useState("");
  const [avulsaData, setAvulsaData] = useState(todayIso());
  const [avulsaProfessorId, setAvulsaProfessorId] = useState("");
  const [avulsaHora, setAvulsaHora] = useState("");
  const [avulsaValor, setAvulsaValor] = useState("");
  const [avulsaObservacao, setAvulsaObservacao] = useState("");
  const [avulsaCategoria, setAvulsaCategoria] = useState("");
  const [avulsaSubcategoria, setAvulsaSubcategoria] = useState("");
  const [avulsaMsg, setAvulsaMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: alunos = [] } = useQuery<AlunoItem[]>({
    queryKey: ["alunos-lista-aula-avulsa"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/alunos`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: professores = [] } = useQuery<any[]>({
    queryKey: ["agenda-professores-aula-avulsa"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/agenda/professores`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: categorias = [] } = useQuery<any[]>({
    queryKey: ["categorias-aula-avulsa-home"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/categorias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: subcategorias = [] } = useQuery<any[]>({
    queryKey: ["subcategorias-aula-avulsa-home"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/subcategorias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: disponibilidadeAvulsa } = useQuery<{ horarios_livres: string[] }>({
    queryKey: ["disponibilidade-avulsa-home", alunoId, avulsaData, avulsaProfessorId],
    queryFn: async () => {
      if (!alunoId || !avulsaProfessorId || !avulsaData) return { horarios_livres: [] };
      const qs = new URLSearchParams({
        data: avulsaData,
        professor_id: avulsaProfessorId,
        duracao_minutos: "60",
      });
      const res = await fetch(`${API_URL}/alunos/${alunoId}/aulas-avulsas/disponibilidade?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) return { horarios_livres: [] };
      return res.json();
    },
    enabled: !!alunoId && !!avulsaProfessorId && !!avulsaData,
  });

  const alunosAtivos = useMemo(
    () =>
      [...alunos]
        .filter((a) => !a.status || a.status === "ativo")
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" })),
    [alunos]
  );

  const alunoSelecionado = useMemo(() => alunos.find((a) => String(a.id) === alunoId), [alunos, alunoId]);

  const subcategoriasFiltradasAvulsa = useMemo(
    () => subcategorias.filter((s: any) => !avulsaCategoria || s.categoria_nome === avulsaCategoria),
    [subcategorias, avulsaCategoria]
  );

  async function salvarAulaAvulsa() {
    if (!alunoId) {
      setAvulsaMsg("Selecione o aluno.");
      return;
    }
    if (!avulsaProfessorId || !avulsaData || !avulsaHora) {
      setAvulsaMsg("Preencha professor, data e horario.");
      return;
    }

    setSaving(true);
    setAvulsaMsg("");
    try {
      const res = await fetch(`${API_URL}/alunos/${alunoId}/aulas-avulsas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professor_id: Number(avulsaProfessorId),
          data: avulsaData,
          hora: avulsaHora,
          valor: Number(String(avulsaValor || "0").replace(",", ".")),
          observacao: avulsaObservacao.trim() || null,
          categoria: avulsaCategoria || null,
          subcategoria: avulsaSubcategoria || null,
          unidade: alunoSelecionado?.unidade || null,
        }),
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        setAvulsaMsg(erro.detail || "Falha ao salvar aula avulsa.");
        return;
      }

      setAvulsaHora("");
      setAvulsaObservacao("");
      setAvulsaValor("");
      setAvulsaCategoria("");
      setAvulsaSubcategoria("");
      setAvulsaMsg("Aula avulsa salva com sucesso.");
    } catch {
      setAvulsaMsg("Falha de rede ao salvar aula avulsa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-5">
      <header className="flex items-center justify-between">
        <Link href="/home" className="inline-flex h-10 items-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-text shadow-soft">
          <ArrowLeft size={14} className="mr-2" />
          Voltar para home
        </Link>
      </header>

      <Section title="Aula Avulsa" subtitle="Selecione o aluno e lance a aula">
        <Card className="space-y-3 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Aluno</p>
          <select
            value={alunoId}
            onChange={(e) => {
              setAlunoId(e.target.value);
              setAvulsaHora("");
              setAvulsaMsg("");
            }}
            className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none"
          >
            <option value="">Selecione</option>
            {alunosAtivos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Professor</p>
          <select
            value={avulsaProfessorId}
            onChange={(e) => {
              setAvulsaProfessorId(e.target.value);
              setAvulsaHora("");
            }}
            className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none"
          >
            <option value="">Selecione</option>
            {professores.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Data</p>
          <Input
            type="date"
            value={avulsaData}
            onChange={(e) => {
              setAvulsaData(e.target.value);
              setAvulsaHora("");
            }}
          />

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Horarios livres</p>
          <select value={avulsaHora} onChange={(e) => setAvulsaHora(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione</option>
            {(disponibilidadeAvulsa?.horarios_livres || []).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Valor</p>
          <Input placeholder="Ex: 120,00" value={avulsaValor} onChange={(e) => setAvulsaValor(e.target.value)} />

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Observacao (opcional)</p>
          <textarea
            value={avulsaObservacao}
            onChange={(e) => setAvulsaObservacao(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Ex: aluno pediu foco no saque hoje"
          />

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Categoria</p>
          <select
            value={avulsaCategoria}
            onChange={(e) => {
              setAvulsaCategoria(e.target.value);
              setAvulsaSubcategoria("");
            }}
            className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none"
          >
            <option value="">Selecione</option>
            {categorias
              .filter((c: any) => c.status === "ativo")
              .map((c: any) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
          </select>

          <p className="text-xs font-medium uppercase tracking-wide text-muted">Subcategoria</p>
          <select value={avulsaSubcategoria} onChange={(e) => setAvulsaSubcategoria(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
            <option value="">Selecione</option>
            {subcategoriasFiltradasAvulsa
              .filter((s: any) => s.status === "ativo")
              .map((s: any) => (
                <option key={s.id} value={s.nome}>
                  {s.nome}
                </option>
              ))}
          </select>

          {avulsaMsg && <p className={`text-sm ${avulsaMsg.includes("sucesso") ? "text-success" : "text-danger"}`}>{avulsaMsg}</p>}

          <Button className="w-full" onClick={salvarAulaAvulsa} disabled={saving}>
            {saving ? "Salvando..." : "Salvar aula avulsa"}
          </Button>

          {alunoId && (
            <Link href={`/alunos/${alunoId}`} className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-border bg-white text-sm font-semibold text-text">
              Abrir ficha do aluno selecionado
            </Link>
          )}
        </Card>
      </Section>
    </main>
  );
}
