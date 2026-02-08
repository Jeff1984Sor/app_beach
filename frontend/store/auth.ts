"use client";

import { create } from "zustand";

export type Role = "gestor" | "professor" | "aluno";

type AuthState = {
  token: string | null;
  role: Role | null;
  nome: string | null;
  setSession: (token: string, role: Role, nome: string) => void;
  hydrate: () => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  role: null,
  nome: null,
  setSession: (token, role, nome) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_role", role);
      localStorage.setItem("auth_nome", nome);
    }
    set({ token, role, nome });
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    const role = localStorage.getItem("auth_role") as Role | null;
    const nome = localStorage.getItem("auth_nome");
    if (token && role && nome) set({ token, role, nome });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_role");
      localStorage.removeItem("auth_nome");
    }
    set({ token: null, role: null, nome: null });
  },
}));
