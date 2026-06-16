import { createContext, useContext, useState, type ReactNode } from "react";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "verdant-auth";

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadUser());
  const [isLoading] = useState(false);

  const persist = (next: User | null) => {
    setUser(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const signIn = async (email: string, _password: string) => {
    await delay(600);
    persist({
      id: `user-${Date.now()}`,
      email,
      name: email.split("@")[0].replace(/[._]/g, " "),
      organization: "City Infrastructure Dept.",
    });
  };

  const signUp = async (email: string, _password: string, name: string) => {
    await delay(700);
    persist({
      id: `user-${Date.now()}`,
      email,
      name,
      organization: "City Infrastructure Dept.",
    });
  };

  const signOut = () => persist(null);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
