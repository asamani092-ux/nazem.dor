import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type AuthUser } from './lib/api';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (phone: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  /** التحميل الكامل للواجهة فقط عند التحقق الأولي من الجلسة — لا يُفرّغ الصفحة لاحقاً */
  const [booting, setBooting] = useState(() => Boolean(getToken()));

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      setBooting(false);
      return;
    }
    try {
      const res = await api<{ status: string; user: AuthUser }>('/api/auth/me');
      if (res.status === 'success' && res.user) setUser(res.user);
      else {
        setToken(null);
        setUser(null);
      }
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function login(phone: string) {
    const res = await api<{ status: string; token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      json: { phone },
    });
    setToken(res.token);
    setUser(res.user);
    setBooting(false);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setBooting(false);
  }

  return (
    <AuthContext.Provider value={{ user, loading: booting, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
