import React, { useState, useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import { Copy, Check, Maximize2, Minimize2 } from 'lucide-react';

export default function CodeViewer({
  code = '',
  language = 'javascript',
  title = '',
  maxHeight = '350px',
  showLineNumbers = true
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const normalizedCode = typeof code === 'object' ? JSON.stringify(code, null, 2) : String(code || '');

  useEffect(() => {
    Prism.highlightAll();
  }, [normalizedCode, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalizedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy code:', e);
    }
  };

  const getPrismLang = (lang) => {
    const map = {
      js: 'javascript',
      javascript: 'javascript',
      html: 'markup',
      markup: 'markup',
      json: 'json',
      css: 'css',
      xpath: 'javascript'
    };
    return map[lang?.toLowerCase()] || 'javascript';
  };

  const prismLang = getPrismLang(language);
  const lines = normalizedCode.split('\n');

  return (
    <div className="code-container">
      <div className="code-toolbar">
        <div className="code-toolbar-left">
          <span className="code-lang-badge">{language}</span>
          {title && <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{title}</span>}
          <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>{lines.length} linhas</span>
        </div>

        <div className="code-toolbar-actions">
          <button
            type="button"
            className={`code-action-btn ${copied ? 'active' : ''}`}
            onClick={handleCopy}
            title="Copiar Código"
          >
            {copied ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          <button
            type="button"
            className="code-action-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Recolher' : 'Expandir'}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      <div
        className="code-content-wrapper"
        style={{ maxHeight: isExpanded ? '80vh' : maxHeight }}
      >
        <pre className={`code-viewer-pre language-${prismLang}`}>
          <code className={`language-${prismLang}`}>
            {normalizedCode}
          </code>
        </pre>
      </div>
    </div>
  );
}
