"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import pb from "./pocketbase";
import type { Hebamme } from "./types";

type AuthState = {
  user: Hebamme | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (name: string, pin: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState>({
  user: null,
  isAdmin: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Hebamme | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const model = pb.authStore.record;
    if (pb.authStore.isValid && model) {
      setUser(model as unknown as Hebamme);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (name: string, pin: string) => {
    const result = await pb
      .collection("hebammen")
      .authWithPassword(name, pin);
    setUser(result.record as unknown as Hebamme);
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
  }, []);

  const isAdmin = user?.rolle === "admin";

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
