import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const refresh = useCallback(
    () => api('/auth/me').then((d) => setUser(d.user)),
    []
  );

  useEffect(() => {
    if (!getToken()) return;
    refresh()
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [refresh]);

  const login = async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { identifier: email, password } });
    setToken(d.token);
    setUser(d.user);
  };
  const logout = () => {
    api('/auth/logout', { method: 'POST' }).catch(() => {}); // lets the activity log show the sign-out
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}
