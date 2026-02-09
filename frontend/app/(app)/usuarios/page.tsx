"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { useAuthStore } from "@/store/auth";

type Role = "gestor" | "professor";

type Usuario = {
  id: number;
  nome: string;
  login: string;
  role: "gestor" | "professor" | "aluno";
  ativo: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function UsuariosPage() {
  const token = useAuthStore((s) => s.token);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<Role>("professor");
  const [editId, setEditId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editLogin, setEditLogin] = useState("");
  const [editSenha, setEditSenha] = useState("");
  const [editRole, setEditRole] = useState<Role>("professor");
  const [editAtivo, setEditAtivo] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function carregar() {
    if (!token) return;
    const res = await fetch(`${API_URL}/usuarios`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setMsg("Sem permissao para listar usuarios.");
      return;
    }
    setUsuarios(await res.json());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return setMsg("Sessao invalida. Faca login novamente.");

    setLoading(true);
    setMsg(null);
    const res = await fetch(`${API_URL}/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nome, login, senha, role }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body.detail || "Falha ao cadastrar usuario.");
      setLoading(false);
      return;
    }

    setNome("");
    setLogin("");
    setSenha("");
    setRole("professor");
    setMsg("Usuario cadastrado com sucesso.");
    await carregar();
    setLoading(false);
  }

  function iniciarEdicao(u: Usuario) {
    setEditId(u.id);
    setEditNome(u.nome);
    setEditLogin(u.login);
    setEditSenha("");
    setEditRole((u.role === "gestor" ? "gestor" : "professor") as Role);
    setEditAtivo(u.ativo);
  }

  async function salvarEdicao() {
    if (!token || !editId) return;
    const res = await fetch(`${API_URL}/usuarios/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nome: editNome, login: editLogin, senha: editSenha || null, role: editRole, ativo: editAtivo }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body.detail || "Falha ao editar usuario.");
      return;
    }
    setEditId(null);
    setMsg("Usuario atualizado.");
    await carregar();
  }

  async function apagar(id: number) {
    if (!token) return;
    const ok = window.confirm("Deseja apagar este usuario?");
    if (!ok) return;
    const res = await fetch(`${API_URL}/usuarios/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body.detail || "Falha ao apagar usuario.");
      return;
    }
    setMsg("Usuario apagado.");
    await carregar();
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="space-y-4">
      <Section title="Usuarios" subtitle="Cadastre apenas gestor e professor. Aluno e cadastrado em Alunos.">
        <Card className="space-y-3">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Nome</p>
              <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Login</p>
              <Input placeholder="Login (palavra)" value={login} onChange={(e) => setLogin(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Senha</p>
              <Input placeholder="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Perfil</p>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
              <option value="gestor">Gestor</option>
              <option value="professor">Professor</option>
            </select>
            </div>
            {msg && <p className="text-sm text-muted">{msg}</p>}
            <Button className="h-11 w-full" disabled={loading}>{loading ? "Salvando..." : "Cadastrar"}</Button>
          </form>
        </Card>
      </Section>

      <Section title="Lista" subtitle="Usuarios cadastrados">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Status</p>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
                className="h-11 rounded-2xl border border-border bg-white px-4 text-text outline-none"
              >
                <option value="ativos">Ativos</option>
                <option value="inativos">Inativos</option>
                <option value="todos">Todos</option>
              </select>
            </div>
          </div>

          {usuarios
            .filter((u) => (filtroStatus === "todos" ? true : filtroStatus === "ativos" ? u.ativo : !u.ativo))
            .map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{u.nome}</p>
                  <p className="text-sm text-muted">login: {u.login}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{u.role}</span>
                  <button onClick={() => iniciarEdicao(u)} className="rounded-xl border border-border p-2 text-muted hover:text-text" aria-label="Editar">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => apagar(u.id)} className="rounded-xl border border-border p-2 text-danger hover:bg-danger/10" aria-label="Apagar">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {editId === u.id && (
                <div className="mt-3 space-y-2 rounded-2xl bg-bg p-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Nome</p>
                    <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Login</p>
                    <Input value={editLogin} onChange={(e) => setEditLogin(e.target.value)} placeholder="Login" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Senha</p>
                    <Input value={editSenha} onChange={(e) => setEditSenha(e.target.value)} placeholder="Nova senha (opcional)" type="password" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Perfil</p>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value as Role)} className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
                    <option value="gestor">Gestor</option>
                    <option value="professor">Professor</option>
                  </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" checked={editAtivo} onChange={(e) => setEditAtivo(e.target.checked)} />
                    Ativo
                  </label>
                  <div className="flex gap-2">
                    <Button className="h-10 px-4" onClick={salvarEdicao}>Salvar</Button>
                    <button onClick={() => setEditId(null)} className="h-10 rounded-xl border border-border px-4 text-sm">Cancelar</button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Section>
    </main>
  );
}
