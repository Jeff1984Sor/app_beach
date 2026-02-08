"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  | "conta_bancaria"
  | "movimentacoes_financeiras"
  | "categoria"
  | "subcategoria"
  | "modelo_contrato"
  | "media_files"
  | "empresa_config";

type Item = {
  id: number;
  titulo: string;
  detalhe: string;
  status: "ativo" | "inativo";
};

type PlanoApi = {
  id: number;
  nome: string;
  valor: number;
  recorrencia: string;
  qtd_aulas_semanais: number;
  categoria?: string | null;
  subcategoria?: string | null;
  status: "ativo" | "inativo";
};

type ContaBancariaApi = {
  id: number;
  nome_conta: string;
  banco: string;
  agencia: string;
  cc: string;
  saldo: number;
};

type MovimentacaoApi = {
  id: number;
  data_movimento: string;
  tipo: string;
  valor: number;
  descricao: string;
  categoria?: string;
  subcategoria?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

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
  conta_bancaria: "Conta Bancaria",
  movimentacoes_financeiras: "Movimentacoes Financeiras",
  categoria: "Categoria",
  subcategoria: "Subcategoria",
  modelo_contrato: "Modelo de Contrato",
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
  conta_bancaria: [],
  movimentacoes_financeiras: [],
  categoria: [{ id: 1, titulo: "Mensalidades", detalhe: "Receita", status: "ativo" }],
  subcategoria: [{ id: 1, titulo: "Plano Gold", detalhe: "Categoria: Mensalidades | Tipo: Receita", status: "ativo" }],
  modelo_contrato: [{
    id: 1,
    titulo: "Contrato Padrao Beach Tennis",
    detalhe: "Modelo base com variaveis do sistema",
    status: "ativo"
  }],
  media_files: [{ id: 1, titulo: "Logo Oficial", detalhe: "image/png", status: "ativo" }],
  empresa_config: [{ id: 1, titulo: "Beach Club", detalhe: "Cor primaria #0A84FF", status: "ativo" }],
};

export default function ConfiguracoesPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const entidadeParam = params.get("entidade");
  const entidadesValidas: Entidade[] = [
    "usuarios",
    "alunos",
    "unidades",
    "agenda",
    "aulas",
    "contas_receber",
    "contas_pagar",
    "movimentos_bancarios",
    "regras_comissao",
    "plano",
    "conta_bancaria",
    "movimentacoes_financeiras",
    "categoria",
    "subcategoria",
    "modelo_contrato",
    "media_files",
    "empresa_config",
  ];
  const entidade = (entidadeParam && entidadesValidas.includes(entidadeParam as Entidade) ? entidadeParam : "categoria") as Entidade;
  const [data, setData] = useState<Record<Entidade, Item[]>>(seed);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [titulo, setTitulo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [planoValor, setPlanoValor] = useState("");
  const [planoDuracao, setPlanoDuracao] = useState("Mensal");
  const [planoAulas, setPlanoAulas] = useState("");
  const [planoCategoria, setPlanoCategoria] = useState("");
  const [planoSubcategoria, setPlanoSubcategoria] = useState("");
  const [categoriaTipo, setCategoriaTipo] = useState<"Receita" | "Despesa">("Receita");
  const [subcategoriaCategoria, setSubcategoriaCategoria] = useState("");
  const [contratoTexto, setContratoTexto] = useState(`CONTRATO DE PRESTACAO DE SERVICOS - BEACH TENNIS

CONTRATANTE:
Nome: {{aluno_nome}}
Data de nascimento: {{aluno_data_nascimento}}
Endereco: {{aluno_endereco}}
Bairro: {{aluno_bairro}} - CEP: {{aluno_cep}}
Telefone: {{aluno_telefone}}
Responsavel (se menor): {{responsavel_nome}}
CPF: {{responsavel_cpf}}

CONTRATADA:
Razao social: {{empresa_razao_social}}
CNPJ: {{empresa_cnpj}}
Endereco: {{empresa_endereco}}
Unidade: {{unidade_nome}}

PLANO CONTRATADO:
Plano: {{plano_nome}}
Valor: {{plano_valor}}
Duracao: {{plano_duracao}}
Quantidade de aulas semanais: {{plano_qtd_aulas_semanais}}
Dias da semana: {{aula_dias_semana}}
Horario: {{aula_horario}}
Professor: {{professor_nome}}

FINANCEIRO:
Vencimento: {{financeiro_vencimento}}
Forma de pagamento: {{financeiro_forma_pagamento}}
Multa por atraso: {{financeiro_multa}}
Juros: {{financeiro_juros}}

CLAUSULAS:
1. O aluno participara das aulas de Beach Tennis conforme plano contratado.
2. O contrato tem vigencia conforme duracao do plano, renovavel por acordo entre as partes.
3. Faltas do aluno nao geram desconto automatico, salvo previsao expressa.
4. Reposicoes por chuva/indisponibilidade operacional seguirao as regras internas da escola.
5. O nao pagamento podera implicar suspensao de acesso ate regularizacao.
6. O foro eleito para dirimir conflitos e o da comarca de {{empresa_cidade}}/{{empresa_uf}}.

Local e data: {{empresa_cidade}}, {{data_hoje}}

Assinaturas:
CONTRATANTE: ______________________
CONTRATADA: ______________________`);

  const { data: planosApi = [] } = useQuery<PlanoApi[]>({
    queryKey: ["planos-config"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/planos`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: entidade === "plano",
  });
  const { data: contasBancariasApi = [] } = useQuery<ContaBancariaApi[]>({
    queryKey: ["contas-bancarias-config"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/contas-bancarias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: entidade === "conta_bancaria",
  });
  const { data: movimentacoesApi = [] } = useQuery<MovimentacaoApi[]>({
    queryKey: ["movimentacoes-financeiras-config"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/movimentacoes-financeiras`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: entidade === "movimentacoes_financeiras",
  });

  const items = useMemo(() => {
    if (entidade === "conta_bancaria") {
      return contasBancariasApi.map((c) => ({
        id: c.id,
        titulo: c.nome_conta,
        detalhe: `${c.banco} | Ag ${c.agencia} | CC ${c.cc} | Saldo ${Number(c.saldo || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        status: "ativo" as const,
      }));
    }
    if (entidade === "movimentacoes_financeiras") {
      return movimentacoesApi.map((m) => ({
        id: m.id,
        titulo: `${m.tipo.toUpperCase()} - ${Number(m.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        detalhe: `${m.data_movimento} | ${(m.categoria || "Sem categoria")} / ${(m.subcategoria || "Sem subcategoria")} | ${m.descricao || "-"}`,
        status: "ativo" as const,
      }));
    }
    if (entidade !== "plano") return data[entidade] || [];
    return planosApi.map((p) => ({
      id: p.id,
      titulo: p.nome,
      detalhe: `${Number(p.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} | ${p.recorrencia.charAt(0).toUpperCase() + p.recorrencia.slice(1)} | ${p.qtd_aulas_semanais} aulas/sem | ${p.categoria || "Sem categoria"} / ${p.subcategoria || "Sem subcategoria"}`,
      status: p.status,
    }));
  }, [data, entidade, planosApi, contasBancariasApi, movimentacoesApi]);
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
    setPlanoCategoria("");
    setPlanoSubcategoria("");
    setCategoriaTipo("Receita");
    setSubcategoriaCategoria(categoriasAtivas[0] || "");
    if (entidade === "modelo_contrato") {
      setContratoTexto(contratoTexto);
    }
    setOpen(true);
  }

  function openEditar(item: Item) {
    setEditId(item.id);
    setTitulo(item.titulo);
    setDetalhe(item.detalhe);
    setStatus(item.status);
    if (entidade === "plano") {
      const plano = planosApi.find((p) => p.id === item.id);
      if (plano) {
        setPlanoValor(String(plano.valor));
        setPlanoDuracao(plano.recorrencia.charAt(0).toUpperCase() + plano.recorrencia.slice(1));
        setPlanoAulas(String(plano.qtd_aulas_semanais));
        setPlanoCategoria(plano.categoria || "");
        setPlanoSubcategoria(plano.subcategoria || "");
      }
    }
    if (entidade === "conta_bancaria") {
      const conta = contasBancariasApi.find((c) => c.id === item.id);
      if (conta) {
        setTitulo(conta.nome_conta);
        setDetalhe(`${conta.banco} | ${conta.agencia} | ${conta.cc}`);
      }
    }
    if (entidade === "categoria") {
      setCategoriaTipo(item.detalhe === "Despesa" ? "Despesa" : "Receita");
    }
    if (entidade === "subcategoria") {
      const cat = item.detalhe.match(/Categoria:\s*([^|]+)/)?.[1]?.trim() || "";
      setSubcategoriaCategoria(cat);
    }
    if (entidade === "modelo_contrato") {
      setContratoTexto(item.detalhe);
    }
    setOpen(true);
  }

  async function salvar() {
    if (entidade === "plano") {
      const payload = {
        nome: titulo,
        valor: Number(String(planoValor).replace(",", ".")),
        recorrencia: planoDuracao.toLowerCase(),
        qtd_aulas_semanais: Number(planoAulas || 0),
        categoria: planoCategoria || null,
        subcategoria: planoSubcategoria || null,
        status,
      };
      const url = editId ? `${API_URL}/planos/${editId}` : `${API_URL}/planos`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["planos-config"] });
        qc.invalidateQueries({ queryKey: ["planos-contrato"] });
        setOpen(false);
      }
      return;
    }
    if (entidade === "conta_bancaria") {
      const payload = {
        nome_conta: titulo,
        banco: detalhe.split("|")[0]?.trim() || "",
        agencia: detalhe.split("|")[1]?.trim() || "",
        cc: detalhe.split("|")[2]?.trim() || "",
      };
      const url = editId ? `${API_URL}/contas-bancarias/${editId}` : `${API_URL}/contas-bancarias`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["contas-bancarias-config"] });
        setOpen(false);
      }
      return;
    }
    setData((prev) => {
      const atual = [...prev[entidade]];
      const detalheFinal =
        entidade === "categoria"
            ? categoriaTipo
            : entidade === "subcategoria"
              ? `Categoria: ${subcategoriaCategoria} | Tipo: ${tipoDaCategoria(subcategoriaCategoria)}`
          : entidade === "modelo_contrato"
              ? contratoTexto
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

  async function apagar(id: number) {
    if (entidade === "plano") {
      const res = await fetch(`${API_URL}/planos/${id}`, { method: "DELETE" });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["planos-config"] });
        qc.invalidateQueries({ queryKey: ["planos-contrato"] });
      }
      return;
    }
    if (entidade === "conta_bancaria") {
      const res = await fetch(`${API_URL}/contas-bancarias/${id}`, { method: "DELETE" });
      if (res.ok) qc.invalidateQueries({ queryKey: ["contas-bancarias-config"] });
      return;
    }
    if (entidade === "movimentacoes_financeiras") return;
    setData((prev) => ({ ...prev, [entidade]: prev[entidade].filter((x) => x.id !== id) }));
  }

  return (
    <main className="space-y-5">
      <Section title={title} subtitle="Padrao premium com editar, deletar e modal de novo cadastro">
        {(entidade === "categoria" || entidade === "subcategoria") && (
          <div className="flex flex-wrap gap-2">
            <a href="/configuracoes?entidade=categoria" className={`rounded-xl px-3 py-2 text-sm ${entidade === "categoria" ? "bg-primary text-white" : "bg-white text-muted border border-border"}`}>Categoria</a>
            <a href="/configuracoes?entidade=subcategoria" className={`rounded-xl px-3 py-2 text-sm ${entidade === "subcategoria" ? "bg-primary text-white" : "bg-white text-muted border border-border"}`}>Subcategoria</a>
          </div>
        )}
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
                {entidade !== "movimentacoes_financeiras" && (
                  <>
                    <button onClick={() => openEditar(item)} className="rounded-xl border border-border p-2 text-muted transition hover:bg-bg hover:text-text" aria-label="Editar">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => apagar(item.id)} className="rounded-xl border border-border p-2 text-danger transition hover:bg-danger/10" aria-label="Apagar">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
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
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Categoria</p>
                      <Input value={planoCategoria} onChange={(e) => setPlanoCategoria(e.target.value)} placeholder="Ex: Mensalidades" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Subcategoria</p>
                      <Input value={planoSubcategoria} onChange={(e) => setPlanoSubcategoria(e.target.value)} placeholder="Ex: Plano Mensal Gold" />
                    </div>
                  </>
                ) : entidade === "conta_bancaria" ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Banco | Agencia | CC</p>
                      <Input value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="Banco | Agencia | CC" />
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
                ) : entidade === "modelo_contrato" ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Modelo de contrato</p>
                      <textarea
                        value={contratoTexto}
                        onChange={(e) => setContratoTexto(e.target.value)}
                        className="min-h-64 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text outline-none"
                      />
                    </div>
                    <div className="rounded-2xl border border-border bg-bg px-4 py-3 text-xs text-muted">
                      Variaveis disponiveis: {"{{aluno_nome}} {{plano_nome}} {{plano_valor}} {{plano_duracao}} {{plano_qtd_aulas_semanais}} {{professor_nome}} {{empresa_razao_social}} {{empresa_cnpj}} {{empresa_endereco}} {{empresa_cidade}} {{empresa_uf}} {{data_hoje}}"}
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
