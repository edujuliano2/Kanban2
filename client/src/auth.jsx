import { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kanban_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getMe()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem('kanban_token');
      })
      .finally(() => setLoading(false));
  }, []);

  function setSession(token, userData) {
    localStorage.setItem('kanban_token', token);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('kanban_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, setSession, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
