"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Search } from "lucide-react";
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

const alunosMock: AlunoItem[] = [
  { id: 1, nome: "Ana Costa", telefone: "(71) 99999-1101", status: "ativo", unidade: "Unidade Sul" },
  { id: 2, nome: "Jeff Santos", telefone: "(71) 99999-2250", status: "ativo", unidade: "Unidade Centro" },
  { id: 3, nome: "Carla Nunes", telefone: "(71) 99999-8874", status: "inativo", unidade: "Unidade Sul" },
  { id: 4, nome: "Rafa Gomes", telefone: "(71) 99999-7781", status: "ativo", unidade: "Unidade Norte" },
];

async function fetchAlunos(): Promise<AlunoItem[]> {
  await new Promise((r) => setTimeout(r, 300));
  return alunosMock;
}

export default function AlunosPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["alunos-lista"], queryFn: fetchAlunos });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "inativo">("todos");
  const [unidadeFilter, setUnidadeFilter] = useState<string>("todas");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const unidades = useMemo(() => ["todas", ...Array.from(new Set(data.map((x) => x.unidade)))], [data]);

  const filtrados = useMemo(() => {
    return data.filter((a) => {
      const bySearch = !debouncedSearch || a.nome.toLowerCase().includes(debouncedSearch) || a.telefone.toLowerCase().includes(debouncedSearch);
      const byStatus = statusFilter === "todos" || a.status === statusFilter;
      const byUnidade = unidadeFilter === "todas" || a.unidade === unidadeFilter;
      return bySearch && byStatus && byUnidade;
    });
  }, [data, debouncedSearch, statusFilter, unidadeFilter]);

  return (
    <main className="space-y-5 bg-bg">
      <Section title="Alunos" subtitle="Gestao premium de alunos">
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              className="h-12 pl-11"
              placeholder="Buscar por nome ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link href="/alunos/novo" className="inline-flex h-10 items-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-text shadow-soft">
            <Plus size={14} className="mr-1" /> Novo Aluno
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

      <section className="space-y-3">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-24 animate-pulse bg-white/90" />
        ))}

        {!isLoading && filtrados.map((aluno) => (
          <Link key={aluno.id} href={`/alunos/${aluno.id}`}>
            <motion.div whileTap={{ scale: 0.99 }} whileHover={{ y: -1 }}>
              <Card className="flex items-center justify-between p-5 transition hover:shadow-md">
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-text">{aluno.nome}</p>
                  <p className="text-sm text-muted">{aluno.telefone}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone={aluno.status === "ativo" ? "success" : "danger"}>{aluno.status}</Badge>
                    <span className="text-xs text-muted">{aluno.unidade}</span>
                  </div>
                </div>
                <ChevronRight className="text-muted" size={18} />
              </Card>
            </motion.div>
          </Link>
        ))}
      </section>
    </main>
  );
}
