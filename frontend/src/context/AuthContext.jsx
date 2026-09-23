import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('invoicepro_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('invoicepro_token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      async login(email, password) {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('invoicepro_token', data.token);
        setUser(data.user);
        return data.user;
      },
      async signup(payload) {
        const { data } = await api.post('/auth/signup', payload);
        localStorage.setItem('invoicepro_token', data.token);
        setUser(data.user);
        return data.user;
      },
      async logout() {
        try {
          await api.post('/auth/logout');
        } catch {
          // token is cleared locally either way
        }
        localStorage.removeItem('invoicepro_token');
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
