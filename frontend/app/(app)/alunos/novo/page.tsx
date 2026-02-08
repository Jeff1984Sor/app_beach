"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";
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
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function buscarCep(cepValue: string) {
    const clean = cepValue.replace(/\D/g, "");
    if (clean.length !== 8) return;
    const res = await fetch(`${API_URL}/public/cep/${clean}`);
    if (!res.ok) return;
    const data = await res.json();
    setEndereco(`${data.logradouro || ""}, ${data.bairro || ""} - ${data.cidade || ""}/${data.uf || ""}`.trim());
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/alunos/cadastro`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        nome,
        login,
        telefone,
        email: email || null,
        data_aniversario: aniversario || null,
        cep: cep || null,
        endereco: endereco || null,
      }),
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
      <Section title="Novo Aluno" subtitle="Senha padrao de acesso: 123">
        <Card>
          <form onSubmit={salvar} className="space-y-3">
            <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <Input placeholder="Login" value={login} onChange={(e) => setLogin(e.target.value)} required />
            <div className="relative">
              <MessageCircle size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-success" />
              <Input className="pl-11" placeholder="Telefone (WhatsApp)" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <Input className="pl-11" placeholder="E-mail (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Input type="date" placeholder="Data de aniversario" value={aniversario} onChange={(e) => setAniversario(e.target.value)} />
            <Input placeholder="CEP" value={cep} onChange={(e) => setCep(e.target.value)} onBlur={(e) => buscarCep(e.target.value)} />
            <Input placeholder="Endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            {msg && <p className="text-sm text-danger">{msg}</p>}
            <Button className="w-full">Salvar</Button>
          </form>
        </Card>
      </Section>
    </main>
  );
}
