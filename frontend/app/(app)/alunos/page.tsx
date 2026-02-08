"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { useAuthStore } from "@/store/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8010/api/v1";

export default function AlunosPage() {
  const tokenStore = useAuthStore((s) => s.token);
  const token = tokenStore || (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  const [detalhes, setDetalhes] = useState(false);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return setMsg("Sessao invalida. Faca login novamente.");

    setLoading(true);
    setMsg(null);

    const res = await fetch(`${API_URL}/alunos/cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nome, login, senha, telefone: telefone || null }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body.detail || "Falha ao cadastrar aluno.");
      setLoading(false);
      return;
    }

    setNome("");
    setLogin("");
    setSenha("");
    setTelefone("");
    setMsg("Aluno cadastrado com perfil aluno automaticamente.");
    setLoading(false);
  }

  return (
    <main className="space-y-4">
      <Section title="Cadastro de Aluno" subtitle="Sempre cria com perfil aluno automaticamente">
        <Card className="space-y-3">
          <form onSubmit={onSubmit} className="space-y-3">
            <Input placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <Input placeholder="Login (palavra)" value={login} onChange={(e) => setLogin(e.target.value)} required />
            <Input placeholder="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            <button type="button" onClick={() => setDetalhes((v) => !v)} className="text-sm font-medium text-primary">
              {detalhes ? "Ocultar detalhes" : "Ver mais detalhes"}
            </button>
            {detalhes && (
              <div className="space-y-3 rounded-2xl bg-bg p-3">
                <Input placeholder="CPF" />
                <Input placeholder="CEP" />
                <Input placeholder="Endereco" />
                <Input placeholder="Observacoes" />
              </div>
            )}
            {msg && <p className="text-sm text-muted">{msg}</p>}
            <Button className="w-full" disabled={loading}>{loading ? "Salvando..." : "Salvar aluno"}</Button>
          </form>
        </Card>
      </Section>
    </main>
  );
}
