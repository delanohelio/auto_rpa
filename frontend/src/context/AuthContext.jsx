import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const apiFetch = async (url, options = {}) => {
    const saved = localStorage.getItem('systemPassword');
    const headers = { ...(options.headers || {}) };

    if (saved) {
      headers['x-system-password'] = saved;
    }
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('systemPassword');
      setIsAuthenticated(false);
      throw new Error('Acesso não autorizado. Por favor, autentique-se.');
    }
    return res;
  };

  const checkAuthStatus = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/status').then(r => r.json());
      setAuthRequired(!!res.required);

      if (res.required) {
        const saved = localStorage.getItem('systemPassword');
        if (!saved) {
          setIsAuthenticated(false);
        } else {
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: saved })
          });
          if (loginRes.ok) {
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('systemPassword');
            setIsAuthenticated(false);
          }
        }
      } else {
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const login = async (password) => {
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        localStorage.setItem('systemPassword', password);
        setIsAuthenticated(true);
        return true;
      } else {
        setAuthError('Senha incorreta.');
        return false;
      }
    } catch (err) {
      setAuthError('Erro de conexão ao autenticar.');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('systemPassword');
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authRequired,
        authLoading,
        authError,
        setAuthError,
        login,
        logout,
        apiFetch
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
