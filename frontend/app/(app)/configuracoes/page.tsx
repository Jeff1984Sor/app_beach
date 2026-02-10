"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Entidade =
  | "usuarios"
  | "alunos"
  | "unidades"
  | "agenda"
  | "contas_receber"
  | "contas_pagar"
  | "regras_comissao"
  | "plano"
  | "conta_bancaria"
  | "movimentacoes_financeiras"
  | "categoria"
  | "subcategoria"
  | "modelo_contrato"
  | "media_files"
  ;

type Item = {
  id: number;
  titulo: string;
  detalhe: string;
  status: "ativo" | "inativo" | "aberto" | "pago";
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

type ContaReceberApi = {
  id: number;
  aluno_id: number;
  aluno_nome: string;
  contrato_id?: number | null;
  plano_nome?: string;
  valor: number;
  vencimento: string;
  status: string;
  data_pagamento?: string | null;
};

type ContaPagarApi = {
  id: number;
  descricao: string;
  valor: number;
  vencimento: string | null;
  vencimento_br: string;
  categoria?: string | null;
  subcategoria?: string | null;
  status: string;
  data_pagamento?: string | null;
  data_pagamento_br?: string | null;
};

type UnidadeApi = {
  id: number;
  nome: string;
  cep: string;
  endereco: string;
};

type CategoriaApi = {
  id: number;
  nome: string;
  tipo: "Receita" | "Despesa";
  status: "ativo" | "inativo";
};

type SubcategoriaApi = {
  id: number;
  nome: string;
  categoria_id: number;
  categoria_nome: string;
  categoria_tipo: "Receita" | "Despesa";
  status: "ativo" | "inativo";
};

type RegraComissaoApi = {
  id: number;
  profissional_id: number;
  professor_nome: string;
  tipo: "percentual" | "valor_aula";
  percentual: number;
  valor_por_aula: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const LABELS: Record<Entidade, string> = {
  usuarios: "Usuarios",
  alunos: "Alunos",
  unidades: "Unidades",
  agenda: "Agenda",
  contas_receber: "Contas a Receber",
  contas_pagar: "Contas a Pagar",
  regras_comissao: "Regras de Comissao",
  plano: "Plano",
  conta_bancaria: "Conta Bancaria",
  movimentacoes_financeiras: "Movimentacoes Financeiras",
  categoria: "Categoria",
  subcategoria: "Subcategoria",
  modelo_contrato: "Modelo de Contrato",
  media_files: "Media Files",
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
    "contas_receber",
    "contas_pagar",
    "regras_comissao",
    "plano",
    "conta_bancaria",
    "movimentacoes_financeiras",
    "categoria",
    "subcategoria",
    "modelo_contrato",
    "media_files",
  ];
  const entidade = (entidadeParam && entidadesValidas.includes(entidadeParam as Entidade) ? entidadeParam : "categoria") as Entidade;

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [titulo, setTitulo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [contasReceberFiltroStatus, setContasReceberFiltroStatus] = useState<"aberto" | "pago" | "todos">("aberto");
  const [planoValor, setPlanoValor] = useState("");
  const [planoDuracao, setPlanoDuracao] = useState("Mensal");
  const [planoAulas, setPlanoAulas] = useState("");
  const [planoCategoria, setPlanoCategoria] = useState("");
  const [planoSubcategoria, setPlanoSubcategoria] = useState("");
  const [contaBanco, setContaBanco] = useState("");
  const [contaAgencia, setContaAgencia] = useState("");
  const [contaCc, setContaCc] = useState("");
  const [unidadeCep, setUnidadeCep] = useState("");
  const [unidadeEndereco, setUnidadeEndereco] = useState("");
  const [categoriaTipo, setCategoriaTipo] = useState<"Receita" | "Despesa">("Receita");
  const [subcategoriaCategoria, setSubcategoriaCategoria] = useState("");
  const [contaPagarValor, setContaPagarValor] = useState("");
  const [contaPagarVencimento, setContaPagarVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [contaPagarCategoria, setContaPagarCategoria] = useState("");
  const [contaPagarSubcategoria, setContaPagarSubcategoria] = useState("");
  const [contaPagarRecorrencia, setContaPagarRecorrencia] = useState(false);
  const [contaPagarQtdRecorrencias, setContaPagarQtdRecorrencias] = useState("1");
  const [regraProfessorId, setRegraProfessorId] = useState("");
  const [regraTipo, setRegraTipo] = useState<"percentual" | "valor_aula">("percentual");
  const [regraPercentual, setRegraPercentual] = useState("");
  const [regraValorAula, setRegraValorAula] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payContaId, setPayContaId] = useState<number | null>(null);
  const [payDataPagamento, setPayDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [payContaBancariaId, setPayContaBancariaId] = useState<string>("");
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
    enabled: entidade === "conta_bancaria" || entidade === "contas_receber",
  });
  const { data: unidadesApi = [] } = useQuery<UnidadeApi[]>({
    queryKey: ["unidades-config"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/unidades`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: entidade === "unidades",
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
  const { data: contasReceberApi = [] } = useQuery<ContaReceberApi[]>({
    queryKey: ["contas-receber-config"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/contas-receber`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: entidade === "contas_receber",
  });
  const { data: contasPagarApi = [] } = useQuery<ContaPagarApi[]>({
    queryKey: ["contas-pagar-config"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/contas-pagar`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: entidade === "contas_pagar",
  });
  const { data: categoriasApi = [] } = useQuery<CategoriaApi[]>({
    queryKey: ["categorias-config"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/categorias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: entidade === "categoria" || entidade === "subcategoria" || entidade === "plano",
  });
  const { data: subcategoriasApi = [] } = useQuery<SubcategoriaApi[]>({
    queryKey: ["subcategorias-config"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/subcategorias`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: entidade === "subcategoria" || entidade === "plano",
  });
  const { data: regrasComissaoApi = [] } = useQuery<RegraComissaoApi[]>({
    queryKey: ["regras-comissao-config"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/regras-comissao`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: entidade === "regras_comissao",
  });
  const { data: professoresApi = [] } = useQuery<any[]>({
    queryKey: ["agenda-professores-config"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/agenda/professores`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: entidade === "regras_comissao",
  });

  const items = useMemo(() => {
    if (entidade === "unidades") {
      return unidadesApi.map((u) => ({
        id: u.id,
        titulo: u.nome,
        detalhe: `${(u.cep || "").trim() || "--"} • ${(u.endereco || "").trim() || "Nao informado"}`,
        status: "ativo" as const,
      }));
    }
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
    if (entidade === "categoria") {
      return categoriasApi.map((c) => ({
        id: c.id,
        titulo: c.nome,
        detalhe: c.tipo,
        status: c.status,
      }));
    }
    if (entidade === "subcategoria") {
      return subcategoriasApi.map((s) => ({
        id: s.id,
        titulo: s.nome,
        detalhe: `Categoria: ${s.categoria_nome} | Tipo: ${s.categoria_tipo}`,
        status: s.status,
      }));
    }
    if (entidade === "plano") {
      return planosApi.map((p) => ({
        id: p.id,
        titulo: p.nome,
        detalhe: `${Number(p.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} | ${p.recorrencia.charAt(0).toUpperCase() + p.recorrencia.slice(1)} | ${p.qtd_aulas_semanais} aulas/sem | ${p.categoria || "Sem categoria"} / ${p.subcategoria || "Sem subcategoria"}`,
        status: p.status,
      }));
    }
    if (entidade === "contas_receber") {
      const filtradas =
        contasReceberFiltroStatus === "todos"
          ? contasReceberApi
          : contasReceberApi.filter((c) => String(c.status || "").toLowerCase() === contasReceberFiltroStatus);
      return filtradas.map((c) => ({
        id: c.id,
        titulo: `${c.aluno_nome}${c.plano_nome ? ` • ${c.plano_nome}` : ""}`,
        detalhe: `${Number(c.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} • Venc: ${c.vencimento}${c.data_pagamento ? ` • Pago: ${c.data_pagamento}` : ""} • ${c.status}`,
        status: String(c.status || "").toLowerCase() === "pago" ? ("pago" as const) : ("aberto" as const),
      }));
    }
    if (entidade === "contas_pagar") {
      return contasPagarApi.map((c) => ({
        id: c.id,
        titulo: c.descricao,
        detalhe: `${Number(c.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} • Venc: ${c.vencimento_br} • ${c.categoria || "Sem categoria"} / ${c.subcategoria || "Sem subcategoria"}`,
        status: String(c.status || "").toLowerCase() === "inativo" ? ("inativo" as const) : ("ativo" as const),
      }));
    }
    if (entidade === "regras_comissao") {
      return regrasComissaoApi.map((r) => ({
        id: r.id,
        titulo: r.professor_nome,
        detalhe:
          r.tipo === "valor_aula"
            ? `${Number(r.valor_por_aula || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por aula`
            : `${Number(r.percentual || 0).toFixed(2)}% sobre aulas realizadas`,
        status: "ativo" as const,
      }));
    }

    // Entidades sem backend ainda: sem dados falsos.
    return [];
  }, [
    entidade,
    planosApi,
    contasBancariasApi,
    unidadesApi,
    movimentacoesApi,
    categoriasApi,
    subcategoriasApi,
    contasReceberApi,
    contasReceberFiltroStatus,
    contasPagarApi,
    regrasComissaoApi,
  ]);
  const categoriasAtivas = useMemo(
    () => categoriasApi.filter((x) => x.status === "ativo").map((x) => x.nome),
    [categoriasApi]
  );
  const categoriasDespesaAtivas = useMemo(
    () => categoriasApi.filter((x) => x.status === "ativo" && x.tipo === "Despesa").map((x) => x.nome),
    [categoriasApi]
  );
  const subcategoriasFiltradasPlano = useMemo(
    () => subcategoriasApi.filter((s) => !planoCategoria || s.categoria_nome === planoCategoria),
    [subcategoriasApi, planoCategoria]
  );
  const subcategoriasFiltradasContaPagar = useMemo(
    () => subcategoriasApi.filter((s) => !contaPagarCategoria || s.categoria_nome === contaPagarCategoria),
    [subcategoriasApi, contaPagarCategoria]
  );
  const title = LABELS[entidade] || "Configuracoes";

  function tipoDaCategoria(nomeCategoria: string): "Receita" | "Despesa" {
    const cat = categoriasApi.find((x) => x.nome === nomeCategoria);
    return cat?.tipo === "Despesa" ? "Despesa" : "Receita";
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
    setContaBanco("");
    setContaAgencia("");
    setContaCc("");
    setUnidadeCep("");
    setUnidadeEndereco("");
    setCategoriaTipo("Receita");
    setSubcategoriaCategoria(categoriasAtivas[0] || "");
    setContaPagarValor("");
    setContaPagarVencimento(new Date().toISOString().slice(0, 10));
    setContaPagarCategoria(categoriasDespesaAtivas[0] || "");
    setContaPagarSubcategoria("");
    setContaPagarRecorrencia(false);
    setContaPagarQtdRecorrencias("1");
    setRegraProfessorId(professoresApi?.[0]?.id ? String(professoresApi[0].id) : "");
    setRegraTipo("percentual");
    setRegraPercentual("");
    setRegraValorAula("");
    if (entidade === "modelo_contrato") {
      setContratoTexto(contratoTexto);
    }
    setOpen(true);
  }

  function openEditar(item: Item) {
    setEditId(item.id);
    setTitulo(item.titulo);
    setDetalhe(item.detalhe);
    setStatus(item.status === "inativo" ? "inativo" : "ativo");
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
    if (entidade === "unidades") {
      const un = unidadesApi.find((u) => u.id === item.id);
      if (un) {
        setTitulo(un.nome || "");
        setUnidadeCep(un.cep || "");
        setUnidadeEndereco(un.endereco || "");
      }
    }
    if (entidade === "conta_bancaria") {
      const conta = contasBancariasApi.find((c) => c.id === item.id);
      if (conta) {
        setTitulo(conta.nome_conta);
        setContaBanco(conta.banco || "");
        setContaAgencia(conta.agencia || "");
        setContaCc(conta.cc || "");
      }
    }
    if (entidade === "categoria") {
      const categoria = categoriasApi.find((c) => c.id === item.id);
      setCategoriaTipo(categoria?.tipo || "Receita");
    }
    if (entidade === "subcategoria") {
      const sub = subcategoriasApi.find((s) => s.id === item.id);
      setSubcategoriaCategoria(sub?.categoria_nome || "");
    }
    if (entidade === "contas_pagar") {
      const conta = contasPagarApi.find((c) => c.id === item.id);
      if (conta) {
        setTitulo(conta.descricao || "");
        setContaPagarValor(String(conta.valor || 0));
        setContaPagarVencimento(conta.vencimento || new Date().toISOString().slice(0, 10));
        setContaPagarCategoria(conta.categoria || "");
        setContaPagarSubcategoria(conta.subcategoria || "");
        setContaPagarRecorrencia(false);
        setContaPagarQtdRecorrencias("1");
      }
    }
    if (entidade === "regras_comissao") {
      const regra = regrasComissaoApi.find((r) => r.id === item.id);
      if (regra) {
        setRegraProfessorId(String(regra.profissional_id));
        setRegraTipo(regra.tipo);
        setRegraPercentual(String(regra.percentual || ""));
        setRegraValorAula(String(regra.valor_por_aula || ""));
      }
    }
    if (entidade === "modelo_contrato") {
      setContratoTexto(item.detalhe);
    }
    setOpen(true);
  }

  function openPagarContaReceber(id: number) {
    setPayContaId(id);
    setPayDataPagamento(new Date().toISOString().slice(0, 10));
    setPayContaBancariaId("");
    setPayOpen(true);
  }

  async function confirmarPagamentoContaReceber() {
    if (!payContaId) return;
    const payload = {
      data_pagamento: payDataPagamento,
      conta_bancaria_id: payContaBancariaId ? Number(payContaBancariaId) : null,
    };
    const res = await fetch(`${API_URL}/contas-receber/${payContaId}/pagar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["contas-receber-config"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes-financeiras-config"] });
      qc.invalidateQueries({ queryKey: ["contas-bancarias-config"] });
      setPayOpen(false);
      setPayContaId(null);
    } else {
      const err = await res.json().catch(() => ({}));
      window.alert(err.detail || "Falha ao dar baixa no recebimento.");
    }
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
        banco: contaBanco.trim(),
        agencia: contaAgencia.trim(),
        cc: contaCc.trim(),
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
    if (entidade === "unidades") {
      const payload = { nome: titulo, cep: unidadeCep, endereco: unidadeEndereco };
      const url = editId ? `${API_URL}/unidades/${editId}` : `${API_URL}/unidades`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["unidades-config"] });
        qc.invalidateQueries({ queryKey: ["unidades"] });
        setOpen(false);
      }
      return;
    }
    if (entidade === "categoria") {
      const payload = { nome: titulo, tipo: categoriaTipo, status };
      const url = editId ? `${API_URL}/categorias/${editId}` : `${API_URL}/categorias`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["categorias-config"] });
        qc.invalidateQueries({ queryKey: ["subcategorias-config"] });
        setOpen(false);
      }
      return;
    }
    if (entidade === "subcategoria") {
      const categoria = categoriasApi.find((c) => c.nome === subcategoriaCategoria);
      if (!categoria) return;
      const payload = { nome: titulo, categoria_id: categoria.id, status };
      const url = editId ? `${API_URL}/subcategorias/${editId}` : `${API_URL}/subcategorias`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["categorias-config"] });
        qc.invalidateQueries({ queryKey: ["subcategorias-config"] });
        setOpen(false);
      }
      return;
    }
    if (entidade === "contas_pagar") {
      const payload = {
        descricao: titulo,
        valor: Number(String(contaPagarValor || "0").replace(",", ".")),
        vencimento: contaPagarVencimento,
        categoria: contaPagarCategoria || null,
        subcategoria: contaPagarSubcategoria || null,
        recorrencia: contaPagarRecorrencia ? "mensal" : null,
        quantidade_recorrencias: contaPagarRecorrencia ? Number(contaPagarQtdRecorrencias || 1) : 1,
      };
      const url = editId ? `${API_URL}/contas-pagar/${editId}` : `${API_URL}/contas-pagar`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["contas-pagar-config"] });
        setOpen(false);
      }
      return;
    }
    if (entidade === "regras_comissao") {
      const payload: any = {
        profissional_id: Number(regraProfessorId),
        tipo: regraTipo,
        percentual: regraTipo === "percentual" ? Number(String(regraPercentual || "0").replace(",", ".")) : 0,
        valor_por_aula: regraTipo === "valor_aula" ? Number(String(regraValorAula || "0").replace(",", ".")) : 0,
      };
      const url = editId ? `${API_URL}/regras-comissao/${editId}` : `${API_URL}/regras-comissao`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["regras-comissao-config"] });
        setOpen(false);
      }
      return;
    }
    // Entidades sem backend ainda: nao criar dados falsos na UI.
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
    if (entidade === "unidades") {
      const res = await fetch(`${API_URL}/unidades/${id}`, { method: "DELETE" });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["unidades-config"] });
        qc.invalidateQueries({ queryKey: ["unidades"] });
      }
      return;
    }
    if (entidade === "categoria") {
      const res = await fetch(`${API_URL}/categorias/${id}`, { method: "DELETE" });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["categorias-config"] });
        qc.invalidateQueries({ queryKey: ["subcategorias-config"] });
      }
      return;
    }
    if (entidade === "subcategoria") {
      const res = await fetch(`${API_URL}/subcategorias/${id}`, { method: "DELETE" });
      if (res.ok) qc.invalidateQueries({ queryKey: ["subcategorias-config"] });
      return;
    }
    if (entidade === "contas_pagar") {
      const res = await fetch(`${API_URL}/contas-pagar/${id}`, { method: "DELETE" });
      if (res.ok) qc.invalidateQueries({ queryKey: ["contas-pagar-config"] });
      return;
    }
    if (entidade === "regras_comissao") {
      const res = await fetch(`${API_URL}/regras-comissao/${id}`, { method: "DELETE" });
      if (res.ok) qc.invalidateQueries({ queryKey: ["regras-comissao-config"] });
      return;
    }
    if (entidade === "movimentacoes_financeiras") return;
    return;
  }

  return (
    <main className="space-y-5">
      <Section title={title} subtitle="Padrao premium com editar, deletar e modal de novo cadastro">
        <div className="flex flex-wrap items-center gap-2">
          {entidade === "regras_comissao" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  const res = await fetch(`${API_URL}/comissoes/gerar-contas-pagar`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  });
                  if (res.ok) {
                    qc.invalidateQueries({ queryKey: ["contas-pagar-config"] });
                    window.alert("Contas a pagar de comissao geradas (mes anterior).");
                  } else {
                    const err = await res.json().catch(() => ({}));
                    window.alert(err.detail || "Falha ao gerar comissao.");
                  }
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-text shadow-soft hover:bg-bg"
              >
                Gerar comissao do mes
              </button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {entidade === "contas_receber" && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted">Status</span>
                <select
                  value={contasReceberFiltroStatus}
                  onChange={(e) => setContasReceberFiltroStatus(e.target.value as "aberto" | "pago" | "todos")}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-text shadow-soft hover:bg-bg"
                >
                  <option value="aberto">Em aberto</option>
                  <option value="pago">Pagas</option>
                  <option value="todos">Todas</option>
                </select>
              </div>
            )}
            <button onClick={openNovo} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft">
              <Plus size={16} /> Novo
            </button>
          </div>
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
                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    item.status === "ativo"
                      ? "bg-success/10 text-success"
                      : item.status === "inativo"
                        ? "bg-danger/10 text-danger"
                        : item.status === "pago"
                          ? "bg-success/10 text-success"
                          : "bg-primary/10 text-primary"
                  }`}
                >
                  {item.status}
                </span>
                {entidade !== "movimentacoes_financeiras" && (
                  <>
                    {entidade === "contas_receber" ? (
                      <button
                        onClick={() => openPagarContaReceber(item.id)}
                        className="rounded-xl border border-border p-2 text-success transition hover:bg-success/10"
                        aria-label="Dar como paga"
                        title="Dar como paga"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    ) : (
                      <button onClick={() => openEditar(item)} className="rounded-xl border border-border p-2 text-muted transition hover:bg-bg hover:text-text" aria-label="Editar">
                        {/* Reuse lucide already imported in Button system; keep lightweight */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted">
                          <path
                            d="M12 20h9"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                    <button onClick={() => apagar(item.id)} className="rounded-xl border border-border p-2 text-danger transition hover:bg-danger/10" aria-label="Apagar">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
        {items.length === 0 && (
          <Card className="p-5 text-sm text-muted">
            Nenhum item encontrado. Se esta entidade ainda nao tem backend, ela ficara vazia por enquanto (sem dados falsos).
          </Card>
        )}
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
                      <select
                        value={planoCategoria}
                        onChange={(e) => {
                          setPlanoCategoria(e.target.value);
                          setPlanoSubcategoria("");
                        }}
                        className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none"
                      >
                        <option value="">Selecione</option>
                        {categoriasApi
                          .filter((c) => c.status === "ativo")
                          .map((c) => (
                            <option key={c.id} value={c.nome}>
                              {c.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Subcategoria</p>
                      <select
                        value={planoSubcategoria}
                        onChange={(e) => setPlanoSubcategoria(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none"
                      >
                        <option value="">Selecione</option>
                        {subcategoriasFiltradasPlano
                          .filter((s) => s.status === "ativo")
                          .map((s) => (
                            <option key={s.id} value={s.nome}>
                              {s.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                ) : entidade === "conta_bancaria" ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Banco</p>
                      <Input value={contaBanco} onChange={(e) => setContaBanco(e.target.value)} placeholder="Ex: Banco do Brasil" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Agencia</p>
                      <Input value={contaAgencia} onChange={(e) => setContaAgencia(e.target.value)} placeholder="Ex: 1234-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Conta Corrente</p>
                      <Input value={contaCc} onChange={(e) => setContaCc(e.target.value)} placeholder="Ex: 98765-0" />
                    </div>
                  </>
                ) : entidade === "unidades" ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">CEP</p>
                      <Input value={unidadeCep} onChange={(e) => setUnidadeCep(e.target.value)} placeholder="00000000" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Endereco</p>
                      <Input value={unidadeEndereco} onChange={(e) => setUnidadeEndereco(e.target.value)} placeholder="Rua, numero, bairro, cidade" />
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
                ) : entidade === "contas_pagar" ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Valor</p>
                      <Input value={contaPagarValor} onChange={(e) => setContaPagarValor(e.target.value)} placeholder="100,00" />
                      <div className="text-xs text-muted">
                        {Number(String(contaPagarValor || "0").replace(",", ".") || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Vencimento</p>
                      <Input type="date" value={contaPagarVencimento} onChange={(e) => setContaPagarVencimento(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Categoria</p>
                      <select
                        value={contaPagarCategoria}
                        onChange={(e) => {
                          setContaPagarCategoria(e.target.value);
                          setContaPagarSubcategoria("");
                        }}
                        className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none"
                      >
                        <option value="">Selecione</option>
                        {categoriasApi
                          .filter((c) => c.status === "ativo" && c.tipo === "Despesa")
                          .map((c) => (
                            <option key={c.id} value={c.nome}>
                              {c.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Subcategoria</p>
                      <select
                        value={contaPagarSubcategoria}
                        onChange={(e) => setContaPagarSubcategoria(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none"
                      >
                        <option value="">Selecione</option>
                        {subcategoriasFiltradasContaPagar
                          .filter((s) => s.status === "ativo")
                          .map((s) => (
                            <option key={s.id} value={s.nome}>
                              {s.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text">
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">Recorrencia mensal</span>
                        <input type="checkbox" checked={contaPagarRecorrencia} onChange={(e) => setContaPagarRecorrencia(e.target.checked)} />
                      </label>
                      {contaPagarRecorrencia && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted">Quantidade de recorrencias</p>
                          <Input value={contaPagarQtdRecorrencias} onChange={(e) => setContaPagarQtdRecorrencias(e.target.value)} placeholder="Ex: 6" />
                          <div className="text-xs text-muted">Vai lancar 1 por mes, a partir do vencimento informado.</div>
                        </div>
                      )}
                    </div>
                  </>
                ) : entidade === "regras_comissao" ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Professor</p>
                      <select value={regraProfessorId} onChange={(e) => setRegraProfessorId(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
                        <option value="">Selecione</option>
                        {professoresApi.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">Tipo</p>
                      <select value={regraTipo} onChange={(e) => setRegraTipo(e.target.value as any)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
                        <option value="percentual">Percentual</option>
                        <option value="valor_aula">Valor por aula</option>
                      </select>
                    </div>
                    {regraTipo === "percentual" ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted">Percentual (%)</p>
                        <Input value={regraPercentual} onChange={(e) => setRegraPercentual(e.target.value)} placeholder="Ex: 10" />
                        <div className="text-xs text-muted">Calcula em cima do total de aulas realizadas no mes anterior.</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted">Valor por aula</p>
                        <Input value={regraValorAula} onChange={(e) => setRegraValorAula(e.target.value)} placeholder="Ex: 20,00" />
                        <div className="text-xs text-muted">
                          {Number(String(regraValorAula || "0").replace(",", ".") || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por aula realizada.
                        </div>
                      </div>
                    )}
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

      <AnimatePresence>
        {payOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-5 shadow-soft"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Contas a Receber</p>
                  <h3 className="text-xl font-semibold text-text">Dar baixa no recebimento</h3>
                </div>
                <button onClick={() => setPayOpen(false)} className="rounded-xl border border-border p-2 text-muted hover:text-text" aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Data de pagamento</p>
                  <Input type="date" value={payDataPagamento} onChange={(e) => setPayDataPagamento(e.target.value)} />
                  <p className="text-xs text-muted">Sugestao: hoje. Pode alterar se precisar.</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Conta bancaria (opcional)</p>
                  <select
                    value={payContaBancariaId}
                    onChange={(e) => setPayContaBancariaId(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none"
                  >
                    <option value="">Nao informar</option>
                    {contasBancariasApi.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome_conta} ({Number(c.saldo || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button className="h-11 flex-1" onClick={confirmarPagamentoContaReceber}>
                    Confirmar pagamento
                  </Button>
                  <button onClick={() => setPayOpen(false)} className="h-11 rounded-2xl border border-border px-4 text-sm text-muted">
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
