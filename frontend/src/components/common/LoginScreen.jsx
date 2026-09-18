import React, { useState } from 'react';
import { Bot, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const { login, authError } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    await login(password);
    setLoading(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-app)',
        padding: '20px'
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxShadow: 'var(--shadow-lg), 0 0 40px var(--color-primary-glow)'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '16px',
              borderRadius: '50%',
              background: 'var(--color-primary-glow)',
              marginBottom: '16px'
            }}
          >
            <Bot size={36} color="var(--color-secondary)" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>AutoRPA 2.0</h2>
          <p className="text-muted" style={{ fontSize: '13px', marginTop: '6px' }}>
            Autenticação necessária para acessar a orquestração
          </p>
        </div>

        {authError && (
          <div
            style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-danger)',
              borderRadius: '6px',
              color: 'var(--color-danger)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} />
            <span>{authError}</span>
          </div>
        )}

        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px' }}>
            Senha do Sistema
          </label>
          <input
            type="password"
            className="form-control"
            placeholder="Digite a senha de acesso..."
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoFocus
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          disabled={loading}
        >
          {loading ? <RefreshCw className="spin" size={16} /> : <Lock size={16} />}
          Acessar Painel
        </button>
      </form>
    </div>
  );
}
