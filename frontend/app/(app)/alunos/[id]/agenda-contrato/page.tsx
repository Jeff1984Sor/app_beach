"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const diasFixos = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const horasCheias = Array.from({ length: 15 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

export default function AgendaContratoPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const contratoId = search.get("contratoId");
  const horaQuery = search.get("hora");
  const unidadeQuery = search.get("unidade");
  const [dias, setDias] = useState<string[]>(["Seg", "Qua", "Sex"]);
  const [horaInicio, setHoraInicio] = useState(horaQuery && horasCheias.includes(horaQuery) ? horaQuery : "18:00");
  const [duracao, setDuracao] = useState("60");
  const [unidade, setUnidade] = useState(unidadeQuery || "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { data: unidades = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["unidades"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/unidades`, { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  function toggleDia(dia: string) {
    setDias((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]));
  }

  async function confirmar() {
    if (!contratoId) {
      setErro("Contrato nao encontrado.");
      return;
    }
    if (dias.length === 0) {
      setErro("Selecione ao menos um dia da semana.");
      return;
    }
    setSalvando(true);
    setErro("");
    const res = await fetch(`${API_URL}/alunos/${params.id}/contratos/${contratoId}/reservas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dias_semana: dias,
        hora_inicio: horaInicio,
        duracao_minutos: Number(duracao || 60),
        unidade,
      }),
    });
    setSalvando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro(body.detail || "Falha ao reservar agenda.");
      return;
    }
    router.push(`/alunos/${params.id}?tab=Aulas`);
  }

  return (
    <main className="space-y-4">
      <Section title="Agenda do Contrato" subtitle="Escolha os dias da semana para reservar automaticamente">
        <Card className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {diasFixos.map((dia) => (
              <button
                key={dia}
                onClick={() => toggleDia(dia)}
                className={`rounded-xl px-3 py-2 text-sm ${dias.includes(dia) ? "bg-primary text-white" : "border border-border bg-white text-text"}`}
              >
                {dia}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
              {horasCheias.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <Input type="number" min={30} step={30} placeholder="Duracao (min)" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
            <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text outline-none">
              <option value="">Selecione a unidade</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.nome}>{u.nome}</option>
              ))}
            </select>
          </div>
          {erro && <p className="text-sm text-danger">{erro}</p>}
          <Button className="w-full" onClick={confirmar} disabled={salvando}>
            {salvando ? "Reservando..." : "Reservar na agenda"}
          </Button>
        </Card>
      </Section>
    </main>
  );
}
