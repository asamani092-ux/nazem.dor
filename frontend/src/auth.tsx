import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type AuthUser } from './lib/api';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ status: string; user: AuthUser }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function login(phone: string, password: string) {
    const res = await api<{ status: string; token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      json: { phone, password },
    });
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
