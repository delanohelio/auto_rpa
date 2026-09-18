import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, title, message, duration = 4000) => {
    const id = `${Date.now()}_${Math.random()}`;
    const newToast = { id, type, title, message };

    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (title, message) => addToast('success', title, message),
    error: (title, message) => addToast('error', title, message, 6000),
    info: (title, message) => addToast('info', title, message),
    warning: (title, message) => addToast('warning', title, message, 5000)
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item ${t.type}`} role="alert">
            {t.type === 'success' && <CheckCircle2 size={18} color="var(--color-success)" />}
            {t.type === 'error' && <AlertCircle size={18} color="var(--color-danger)" />}
            {t.type === 'info' && <Info size={18} color="var(--color-secondary)" />}
            {t.type === 'warning' && <AlertTriangle size={18} color="var(--color-warning)" />}

            <div className="toast-content">
              {t.title && <div className="toast-title">{t.title}</div>}
              {t.message && <div className="toast-message">{t.message}</div>}
            </div>

            <X
              className="toast-close"
              size={16}
              onClick={() => removeToast(t.id)}
              aria-label="Fechar notificação"
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
