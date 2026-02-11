"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";

type AlunoItem = {
  id: number;
  nome: string;
  telefone: string;
  status: "ativo" | "inativo";
  unidade: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

async function fetchAlunos(): Promise<AlunoItem[]> {
  const res = await fetch(`${API_URL}/alunos`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar alunos");
  return res.json();
}

export default function AlunosPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["alunos-lista"], queryFn: fetchAlunos });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "inativo">("todos");
  const [unidadeFilter, setUnidadeFilter] = useState<string>("todas");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function excluirAluno(alunoId: number) {
    if (!window.confirm("Deseja realmente excluir este aluno? Isso apagara aulas e financeiro vinculados.")) return;
    setDeletingId(alunoId);
    try {
      const res = await fetch(`${API_URL}/alunos/${alunoId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(body?.detail || "Nao foi possivel excluir o aluno.");
        return;
      }
      qc.invalidateQueries({ queryKey: ["alunos-lista"] });
      window.alert("Aluno excluido com sucesso.");
    } finally {
      setDeletingId(null);
    }
  }

  const unidades = useMemo(() => ["todas", ...Array.from(new Set(data.map((x) => x.unidade)))], [data]);

  const filtrados = useMemo(() => {
    return data
      .filter((a) => {
        const bySearch =
          !debouncedSearch || a.nome.toLowerCase().includes(debouncedSearch) || (a.telefone || "").toLowerCase().includes(debouncedSearch);
        const byStatus = statusFilter === "todos" || a.status === statusFilter;
        const byUnidade = unidadeFilter === "todas" || a.unidade === unidadeFilter;
        return bySearch && byStatus && byUnidade;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  }, [data, debouncedSearch, statusFilter, unidadeFilter]);

  return (
    <main className="space-y-5 bg-bg">
      <Section title="Alunos" subtitle="Gestao premium de alunos">
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <Input className="h-12 pl-11" placeholder="Buscar por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Link href="/alunos/novo" className="inline-flex h-10 items-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-text shadow-soft">
            <Plus size={14} className="mr-1" /> Aluno
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "todos" | "ativo" | "inativo")} className="h-11 rounded-2xl border border-border bg-white px-4 text-sm text-text outline-none">
            <option value="todos">Status: Todos</option>
            <option value="ativo">Status: Ativo</option>
            <option value="inativo">Status: Inativo</option>
          </select>
          <select value={unidadeFilter} onChange={(e) => setUnidadeFilter(e.target.value)} className="h-11 rounded-2xl border border-border bg-white px-4 text-sm text-text outline-none">
            {unidades.map((u) => (
              <option key={u} value={u}>{u === "todas" ? "Unidade: Todas" : u}</option>
            ))}
          </select>
        </div>
      </Section>

      <section className="flex flex-col gap-6">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-24 animate-pulse bg-white/90" />)}

        {!isLoading && filtrados.map((aluno) => (
          <Link key={aluno.id} href={`/alunos/${aluno.id}`} className="block">
            <motion.div whileTap={{ scale: 0.99 }} whileHover={{ y: -1 }}>
              <Card className="flex items-center justify-between p-5 transition hover:shadow-md">
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-text">{aluno.nome}</p>
                  <p className="text-sm text-muted">{aluno.telefone || "Sem telefone"}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone={aluno.status === "ativo" ? "success" : "danger"}>{aluno.status}</Badge>
                    <span className="text-xs text-muted">{aluno.unidade}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Excluir aluno"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      excluirAluno(aluno.id);
                    }}
                    disabled={deletingId === aluno.id}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-danger shadow-soft disabled:opacity-60"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight className="text-muted" size={18} />
                </div>
              </Card>
            </motion.div>
          </Link>
        ))}
      </section>
    </main>
  );
}
