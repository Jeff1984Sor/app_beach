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
  const [aniversario, setAniversario] = useState("");\n  const [idade, setIdade] = useState("");\n  const [unidade, setUnidade] = useState("Unidade Sul");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function buscarCep(cepValue: string) {
    const clean = cepValue.replace(/\D/g, "");
    if (clean.length !== 8) return;
    const res = await fetch(`${API_URL}/public/cep/${clean}`);
    if (!res.ok) return;
    const data = await res.json();
    setLogradouro(data.logradouro || "");
    setBairro(data.bairro || "");
    setCidade(data.cidade || "");
    setUf(data.uf || "");
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
        endereco: [logradouro, numero, bairro, cidade, uf].filter(Boolean).join(", ") || null,\n        idade: idade ? Number(idade) : null,\n        unidade,
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
            <div className="grid gap-3 sm:grid-cols-2">\n              <Input type="date" placeholder="Data de aniversario" value={aniversario} onChange={(e) => setAniversario(e.target.value)} />\n              <Input placeholder="Idade" value={idade} onChange={(e) => setIdade(e.target.value)} />\n            </div>\n            <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">\n              <option>Unidade Sul</option><option>Unidade Centro</option><option>Unidade Norte</option>\n            </select>
            <Input
              placeholder="CEP"
              value={cep}
              onChange={(e) => {
                const v = e.target.value;
                setCep(v);
                if (v.replace(/\D/g, "").length === 8) buscarCep(v);
              }}
              onBlur={(e) => buscarCep(e.target.value)}
            />
            <Input placeholder="Logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
            <Input placeholder="Numero" value={numero} onChange={(e) => setNumero(e.target.value)} />
            <Input placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
              <Input placeholder="UF" value={uf} onChange={(e) => setUf(e.target.value)} />
            </div>
            {msg && <p className="text-sm text-danger">{msg}</p>}
            <Button className="w-full">Salvar</Button>
          </form>
        </Card>
      </Section>
    </main>
  );
}

