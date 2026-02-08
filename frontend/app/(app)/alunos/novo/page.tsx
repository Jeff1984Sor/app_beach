"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { useAuthStore } from "@/store/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function calcularIdade(dataIso: string): string {
  if (!dataIso) return "";
  const nasc = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(nasc.getTime())) return "";
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade >= 0 ? String(idade) : "";
}

export default function NovoAlunoPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [unidade, setUnidade] = useState("Unidade Sul");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const idade = useMemo(() => calcularIdade(aniversario), [aniversario]);

  async function buscarCep(cepValue: string) {
    const clean = cepValue.replace(/\D/g, "");
    if (clean.length !== 8) return;

    let data: any = null;

    const local = await fetch(`${API_URL}/public/cep/${clean}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (local && local.logradouro) data = local;

    if (!data) {
      const viacep = await fetch(`https://viacep.com.br/ws/${clean}/json/`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (viacep && !viacep.erro) {
        data = {
          logradouro: viacep.logradouro,
          bairro: viacep.bairro,
          cidade: viacep.localidade,
          uf: viacep.uf,
        };
      }
    }

    if (!data) return;
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
        endereco: [logradouro, numero, bairro, cidade, uf].filter(Boolean).join(", ") || null,
        unidade,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body.detail || "Falha ao salvar aluno");
      return;
    }
    const body = await res.json().catch(() => ({}));
    const alunoId = body?.id;
    if (alunoId && window.confirm("Gostaria de cadastrar um contrato para o novo aluno?")) {
      router.push(`/alunos/${alunoId}?tab=Contratos&novoContrato=1`);
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

            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" placeholder="Data de aniversario" value={aniversario} onChange={(e) => setAniversario(e.target.value)} />
              <Input placeholder="Idade (calculada)" value={idade} readOnly />
            </div>

            <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
              <option>Unidade Sul</option>
              <option>Unidade Centro</option>
              <option>Unidade Norte</option>
            </select>

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
