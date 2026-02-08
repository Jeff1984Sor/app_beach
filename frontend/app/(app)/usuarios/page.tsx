"use client";

import { useEffect, useState } from "react";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8010/api/v1";

export default function UsuariosPage() {
  const tokenStore = useAuthStore((s) => s.token);
  const token = tokenStore || (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<Role>("professor");
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

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="space-y-4">
      <Section title="Usuarios" subtitle="Cadastre apenas gestor e professor. Aluno e cadastrado em Alunos.">
        <Card className="space-y-3">
          <form onSubmit={onSubmit} className="space-y-3">
            <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <Input placeholder="Login (palavra)" value={login} onChange={(e) => setLogin(e.target.value)} required />
            <Input placeholder="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
              <option value="gestor">Gestor</option>
              <option value="professor">Professor</option>
            </select>
            {msg && <p className="text-sm text-muted">{msg}</p>}
            <Button className="h-11 w-full" disabled={loading}>{loading ? "Salvando..." : "Cadastrar"}</Button>
          </form>
        </Card>
      </Section>

      <Section title="Lista" subtitle="Usuarios cadastrados">
        <div className="space-y-2">
          {usuarios.map((u) => (
            <Card key={u.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{u.nome}</p>
                <p className="text-sm text-muted">login: {u.login}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{u.role}</span>
            </Card>
          ))}
        </div>
      </Section>
    </main>
  );
}
