import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken, getToken, setToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const refreshCart = useCallback(async () => {
    if (!getToken()) return setCartCount(0);
    try {
      const { count } = await api('/cart');
      setCartCount(count);
    } catch {
      setCartCount(0);
    }
  }, []);

  // Restore the session on a hard refresh: a stored token still needs validating.
  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) refreshCart();
  }, [user, refreshCart]);

  const handleAuth = ({ token, user }) => {
    setToken(token);
    setUser(user);
  };

  const login = async (email, password) => handleAuth(await api('/auth/login', { method: 'POST', body: { email, password } }));

  const register = async (name, email, password) =>
    handleAuth(await api('/auth/register', { method: 'POST', body: { name, email, password } }));

  const logout = () => {
    clearToken();
    setUser(null);
    setCartCount(0);
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, cartCount, setCartCount, refreshCart }),
    [user, loading, cartCount, refreshCart]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
