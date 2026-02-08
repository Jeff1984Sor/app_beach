"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { useAuthStore } from "@/store/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function NovoAlunoPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/alunos/cadastro`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ nome, login, senha, telefone }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body.detail || "Falha ao salvar aluno");
      return;
    }
    router.push("/alunos");
  }

  return (
    <main className="space-y-4">
      <Section title="Novo Aluno" subtitle="Cadastro rapido e elegante">
        <Card>
          <form onSubmit={salvar} className="space-y-3">
            <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <Input placeholder="Login" value={login} onChange={(e) => setLogin(e.target.value)} required />
            <Input placeholder="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            {msg && <p className="text-sm text-danger">{msg}</p>}
            <Button className="w-full">Salvar</Button>
          </form>
        </Card>
      </Section>
    </main>
  );
}
