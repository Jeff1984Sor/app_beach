"use client";

import { create } from "zustand";

export type Role = "gestor" | "professor" | "aluno";

type AuthState = {
  token: string | null;
  role: Role | null;
  nome: string | null;
  setSession: (token: string, role: Role, nome: string) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  role: null,
  nome: null,
  setSession: (token, role, nome) => set({ token, role, nome }),
  logout: () => set({ token: null, role: null, nome: null }),
}));
