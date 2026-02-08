"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore, Role } from "@/store/auth";

function detectRole(email: string): Role {
  if (email.includes("prof")) return "professor";
  if (email.includes("aluno")) return "aluno";
  return "gestor";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const role = detectRole(email);
      setSession("mock-token", role, email.split("@")[0] || "Usuário");
      router.push("/home");
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-sky-200/60 blur-3xl" />
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-primary to-sky-400 text-4xl font-bold text-white shadow-soft">B</div>
          <h1 className="text-3xl font-semibold tracking-tight">Beach Club SaaS</h1>
          <p className="text-sm text-muted">Acesso inteligente para sua escola</p>
        </div>
        <Card className="border border-border/70 p-6 backdrop-blur">
          <form onSubmit={onSubmit} className="space-y-4">
            <Input placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input placeholder="Sua senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button className="h-12 w-full bg-gradient-to-r from-primary to-sky-500" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
          </form>
        </Card>
      </motion.div>
    </main>
  );
}

