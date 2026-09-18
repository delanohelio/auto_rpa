import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, AlertCircle, Sparkles, Code, Eye, Edit3 } from 'lucide-react';
import CodeViewer from './CodeViewer';

export default function CodeEditor({
  value = '',
  onChange,
  language = 'javascript',
  placeholder = 'Insira o código aqui...',
  rows = 5,
  snippets = [],
  allowPreview = true
}) {
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'preview'
  const [validation, setValidation] = useState({ isValid: true, error: null });

  // Validate JavaScript Syntax
  useEffect(() => {
    if (language !== 'javascript' && language !== 'js') {
      setValidation({ isValid: true, error: null });
      return;
    }

    const trimmed = (value || '').trim();
    if (!trimmed) {
      setValidation({ isValid: true, error: null, isEmpty: true });
      return;
    }

    try {
      // Safely parse JavaScript syntax without executing
      new Function(trimmed);
      setValidation({ isValid: true, error: null, isEmpty: false });
    } catch (err) {
      setValidation({
        isValid: false,
        error: err.message || 'Erro de sintaxe no script',
        isEmpty: false
      });
    }
  }, [value, language]);

  const handleKeyDown = (e) => {
    // Handle Tab key for clean 2-space indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      // Restore cursor position
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const defaultSnippets = useMemo(() => [
    { label: 'Retornar Título', code: '(() => {\n  return document.title;\n})()' },
    { label: 'Extrair Texto', code: '(() => {\n  const el = document.querySelector("h1");\n  return el ? el.innerText.trim() : null;\n})()' },
    { label: 'Listar Links', code: '(() => {\n  return Array.from(document.querySelectorAll("a"))\n    .map(a => ({ text: a.innerText.trim(), href: a.href }))\n    .filter(a => a.href)\n    .slice(0, 30);\n})()' },
    { label: 'Rolar até o Final', code: '(() => {\n  window.scrollTo(0, document.body.scrollHeight);\n  return "Rolagem concluída";\n})()' }
  ], []);

  const activeSnippets = snippets.length > 0 ? snippets : defaultSnippets;

  return (
    <div className={`code-container ${validation.isValid ? (validation.isEmpty ? '' : 'is-valid') : 'has-error'}`}>
      {/* Editor Toolbar */}
      <div className="code-toolbar">
        <div className="code-toolbar-left">
          <span className="code-lang-badge">{language}</span>

          {validation.isEmpty ? (
            <span className="code-validation-badge neutral">
              <span>Script vazio</span>
            </span>
          ) : validation.isValid ? (
            <span className="code-validation-badge valid">
              <CheckCircle2 size={12} />
              <span>Sintaxe Válida</span>
            </span>
          ) : (
            <span className="code-validation-badge invalid">
              <AlertCircle size={12} />
              <span>Erro de Sintaxe</span>
            </span>
          )}
        </div>

        <div className="code-toolbar-actions">
          {allowPreview && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className={`code-action-btn ${activeTab === 'edit' ? 'active' : ''}`}
                onClick={() => setActiveTab('edit')}
              >
                <Edit3 size={11} /> Editar
              </button>
              <button
                type="button"
                className={`code-action-btn ${activeTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                <Eye size={11} /> Visualizar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Snippets Helper Bar */}
      {activeTab === 'edit' && activeSnippets.length > 0 && (
        <div className="code-snippets-bar">
          <span style={{ fontSize: '10px', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={11} color="var(--color-primary)" /> Snippets:
          </span>
          {activeSnippets.map((s, idx) => (
            <button
              key={idx}
              type="button"
              className="code-snippet-chip"
              onClick={() => onChange(s.code)}
              title="Inserir snippet no editor"
            >
              + {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Editor or Preview View */}
      {activeTab === 'edit' ? (
        <div className="code-editor-wrapper">
          <textarea
            className="code-editor-textarea"
            rows={rows}
            placeholder={placeholder}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck="false"
          />
        </div>
      ) : (
        <CodeViewer code={value} language={language} maxHeight="280px" />
      )}

      {/* Syntax Error Alert Message */}
      {!validation.isValid && validation.error && (
        <div className="code-error-banner">
          <AlertCircle size={14} />
          <span>{validation.error}</span>
        </div>
      )}
    </div>
  );
}
