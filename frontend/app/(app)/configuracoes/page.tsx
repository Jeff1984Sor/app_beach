"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Entidade =
  | "usuarios"
  | "alunos"
  | "unidades"
  | "agenda"
  | "aulas"
  | "contas_receber"
  | "contas_pagar"
  | "movimentos_bancarios"
  | "regras_comissao"
  | "plano"
  | "categoria"
  | "subcategoria"
  | "media_files"
  | "empresa_config";

type Item = {
  id: number;
  titulo: string;
  detalhe: string;
  status: "ativo" | "inativo";
};

const LABELS: Record<Entidade, string> = {
  usuarios: "Usuarios",
  alunos: "Alunos",
  unidades: "Unidades",
  agenda: "Agenda",
  aulas: "Aulas",
  contas_receber: "Contas a Receber",
  contas_pagar: "Contas a Pagar",
  movimentos_bancarios: "Movimentos Bancarios",
  regras_comissao: "Regras de Comissao",
  plano: "Plano",
  categoria: "Categoria",
  subcategoria: "Subcategoria",
  media_files: "Media Files",
  empresa_config: "Empresa Config",
};

const seed: Record<Entidade, Item[]> = {
  usuarios: [
    { id: 1, titulo: "Gestor Master", detalhe: "login: gestor", status: "ativo" },
    { id: 2, titulo: "Professor Demo", detalhe: "login: professor", status: "ativo" },
  ],
  alunos: [
    { id: 1, titulo: "Ana Costa", detalhe: "Plano Intermediario", status: "ativo" },
    { id: 2, titulo: "Jeff Santos", detalhe: "Plano Mensal", status: "ativo" },
  ],
  unidades: [{ id: 1, titulo: "Unidade Sul", detalhe: "Sao Paulo", status: "ativo" }],
  agenda: [{ id: 1, titulo: "Agenda Principal", detalhe: "Seg a Sab", status: "ativo" }],
  aulas: [{ id: 1, titulo: "Aula Funcional", detalhe: "08:00", status: "ativo" }],
  contas_receber: [{ id: 1, titulo: "Mensalidade Ana", detalhe: "R$ 380", status: "ativo" }],
  contas_pagar: [{ id: 1, titulo: "Aluguel Quadra", detalhe: "R$ 2.000", status: "ativo" }],
  movimentos_bancarios: [{ id: 1, titulo: "PIX recebido", detalhe: "R$ 550", status: "ativo" }],
  regras_comissao: [{ id: 1, titulo: "Professor", detalhe: "12%", status: "ativo" }],
  plano: [{ id: 1, titulo: "Mensal Gold", detalhe: "R$ 380 | 30 dias | 3 aulas/sem", status: "ativo" }],
  categoria: [{ id: 1, titulo: "Mensalidades", detalhe: "Receita", status: "ativo" }],
  subcategoria: [{ id: 1, titulo: "Plano Gold", detalhe: "Categoria: Mensalidades | Tipo: Receita", status: "ativo" }],
  media_files: [{ id: 1, titulo: "Logo Oficial", detalhe: "image/png", status: "ativo" }],
  empresa_config: [{ id: 1, titulo: "Beach Club", detalhe: "Cor primaria #0A84FF", status: "ativo" }],
};

export default function ConfiguracoesPage() {
  const params = useSearchParams();
  const entidade = (params.get("entidade") || "usuarios") as Entidade;
  const [data, setData] = useState<Record<Entidade, Item[]>>(seed);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [titulo, setTitulo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [planoValor, setPlanoValor] = useState("");
  const [planoDuracao, setPlanoDuracao] = useState("Mensal");
  const [planoAulas, setPlanoAulas] = useState("");
  const [categoriaTipo, setCategoriaTipo] = useState<"Receita" | "Despesa">("Receita");
  const [subcategoriaCategoria, setSubcategoriaCategoria] = useState("");

  const items = useMemo(() => data[entidade] || [], [data, entidade]);
  const categoriasAtivas = useMemo(() => data.categoria.map((x) => x.titulo), [data]);
  const title = LABELS[entidade] || "Configuracoes";

  function tipoDaCategoria(nomeCategoria: string): "Receita" | "Despesa" {
    const cat = data.categoria.find((x) => x.titulo === nomeCategoria);
    return cat?.detalhe === "Despesa" ? "Despesa" : "Receita";
  }

  function openNovo() {
    setEditId(null);
    setTitulo("");
    setDetalhe("");
    setStatus("ativo");
    setPlanoValor("");
    setPlanoDuracao("Mensal");
    setPlanoAulas("");
    setCategoriaTipo("Receita");
    setSubcategoriaCategoria(categoriasAtivas[0] || "");
    setOpen(true);
  }

  function openEditar(item: Item) {
    setEditId(item.id);
    setTitulo(item.titulo);
    setDetalhe(item.detalhe);
    setStatus(item.status);
    if (entidade === "plano") {
      const parts = item.detalhe.split("|").map((x) => x.trim());
      setPlanoValor(parts[0]?.replace("R$ ", "") || "");
      setPlanoDuracao(parts[1] || "Mensal");
      setPlanoAulas(parts[2]?.replace(" aulas/sem", "") || "");
    }
    if (entidade === "categoria") {
      setCategoriaTipo(item.detalhe === "Despesa" ? "Despesa" : "Receita");
    }
    if (entidade === "subcategoria") {
      const cat = item.detalhe.match(/Categoria:\s*([^|]+)/)?.[1]?.trim() || "";
      setSubcategoriaCategoria(cat);
    }
    setOpen(true);
  }

  function salvar() {
    setData((prev) => {
      const atual = [...prev[entidade]];
      const detalheFinal =
        entidade === "plano"
          ? `${planoValor} | ${planoDuracao} | ${planoAulas} aulas/sem`
          : entidade === "categoria"
            ? categoriaTipo
            : entidade === "subcategoria"
              ? `Categoria: ${subcategoriaCategoria} | Tipo: ${tipoDaCategoria(subcategoriaCategoria)}`
          : detalhe;
      if (editId) {
        const idx = atual.findIndex((x) => x.id === editId);
        if (idx >= 0) atual[idx] = { ...atual[idx], titulo, detalhe: detalheFinal, status };
      } else {
        const nextId = Math.max(0, ...atual.map((x) => x.id)) + 1;
        atual.unshift({ id: nextId, titulo, detalhe: detalheFinal, status });
      }
      return { ...prev, [entidade]: atual };
    });
    setOpen(false);
  }

  function apagar(id: number) {
    setData((prev) => ({ ...prev, [entidade]: prev[entidade].filter((x) => x.id !== id) }));
  }

  return (
    <main className="space-y-5">
      <Section title={title} subtitle="Padrao premium com editar, deletar e modal de novo cadastro">
        <div className="flex justify-end">
          <button onClick={openNovo} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft">
            <Plus size={16} /> Novo
          </button>
        </div>
      </Section>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-text">{item.titulo}</p>
                <p className="text-sm text-muted">{item.detalhe}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs ${item.status === "ativo" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                  {item.status}
                </span>
                <button onClick={() => openEditar(item)} className="rounded-xl border border-border p-2 text-muted transition hover:bg-bg hover:text-text" aria-label="Editar">
                  <Pencil size={16} />
                </button>
                <button onClick={() => apagar(item.id)} className="rounded-xl border border-border p-2 text-danger transition hover:bg-danger/10" aria-label="Apagar">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-5 shadow-soft" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Configuracao</p>
                  <h3 className="text-xl font-semibold text-text">{editId ? "Editar item" : `Novo em ${title}`}</h3>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-xl border border-border p-2 text-muted hover:text-text">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{entidade === "plano" ? "Plano" : "Nome"}</p>
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={entidade === "plano" ? "Nome do plano" : "Nome do item"} />
                </div>
                {entidade === "plano" ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Valor</p>
                      <Input value={planoValor} onChange={(e) => setPlanoValor(e.target.value)} placeholder="R$ 380,00" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Duracao</p>
                      <select value={planoDuracao} onChange={(e) => setPlanoDuracao(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
                        <option>Mensal</option>
                        <option>Trimestral</option>
                        <option>Semestral</option>
                        <option>Anual</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Quantidade de aulas semanais</p>
                      <Input value={planoAulas} onChange={(e) => setPlanoAulas(e.target.value)} placeholder="Ex: 3" />
                    </div>
                  </>
                ) : entidade === "categoria" ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Tipo</p>
                    <select value={categoriaTipo} onChange={(e) => setCategoriaTipo(e.target.value as "Receita" | "Despesa")} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
                      <option>Receita</option>
                      <option>Despesa</option>
                    </select>
                  </div>
                ) : entidade === "subcategoria" ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Categoria</p>
                      <select value={subcategoriaCategoria} onChange={(e) => setSubcategoriaCategoria(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
                        {categoriasAtivas.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-muted">
                      Tipo puxado da categoria: <span className="font-semibold text-text">{tipoDaCategoria(subcategoriaCategoria)}</span>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Detalhe</p>
                    <Input value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="Descricao curta" />
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Status</p>
                  <select value={status} onChange={(e) => setStatus(e.target.value as "ativo" | "inativo")} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="h-11 flex-1" onClick={salvar}>{editId ? "Salvar alteracoes" : "Criar item"}</Button>
                  <button onClick={() => setOpen(false)} className="h-11 rounded-2xl border border-border px-4 text-sm text-muted">Cancelar</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
