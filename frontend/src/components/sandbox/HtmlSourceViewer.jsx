import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Copy,
  Check,
  Download,
  X,
  Code,
  Globe,
  Maximize2,
  Minimize2,
  FileCode,
  Layers
} from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';

export default function HtmlSourceViewer({
  html = '',
  url = '',
  title = '',
  isLoading = false,
  onRefresh = null
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const searchInputRef = useRef(null);
  const lineRefs = useRef({});
  const containerRef = useRef(null);

  // Normalize HTML code
  const rawHtml = typeof html === 'string' ? html : String(html || '');

  // Pre-highlight the entire HTML with Prism Markup
  const highlightedLines = useMemo(() => {
    if (!rawHtml) return [];
    try {
      const highlighted = Prism.highlight(rawHtml, Prism.languages.markup, 'markup');
      return highlighted.split('\n');
    } catch (err) {
      console.warn('Prism highlight fallback:', err);
      return rawHtml.split('\n').map(line =>
        line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      );
    }
  }, [rawHtml]);

  // Compute matches across raw lines for search
  const rawLines = useMemo(() => rawHtml.split('\n'), [rawHtml]);

  const matches = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || rawLines.length === 0) return [];

    const results = [];
    const query = caseSensitive ? trimmed : trimmed.toLowerCase();

    rawLines.forEach((lineText, lineIdx) => {
      const target = caseSensitive ? lineText : lineText.toLowerCase();
      let pos = 0;
      while ((pos = target.indexOf(query, pos)) !== -1) {
        results.push({
          lineIndex: lineIdx,
          charIndex: pos,
          queryLength: query.length
        });
        pos += query.length || 1;
      }
    });

    return results;
  }, [rawLines, searchQuery, caseSensitive]);

  // Reset active match index when query or matches change
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery, caseSensitive]);

  // Scroll to active match line
  useEffect(() => {
    if (matches.length > 0 && matches[activeMatchIndex]) {
      const activeLineIdx = matches[activeMatchIndex].lineIndex;
      const el = lineRefs.current[activeLineIdx];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeMatchIndex, matches]);

  const handleNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex(prev => (prev + 1) % matches.length);
  }, [matches]);

  const handlePrevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex(prev => (prev - 1 + matches.length) % matches.length);
  }, [matches]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevMatch();
      } else {
        handleNextMatch();
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
    }
  };

  const handleCopy = async () => {
    if (!rawHtml) return;
    try {
      await navigator.clipboard.writeText(rawHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy HTML:', err);
    }
  };

  const handleDownload = () => {
    if (!rawHtml) return;
    const blob = new Blob([rawHtml], { type: 'text/html;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const safeTitle = (title || 'pagina')
      .replace(/[^a-z0-9_-]/gi, '_')
      .toLowerCase()
      .substring(0, 30);
    a.download = `source_${safeTitle}_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  const activeLineIndex = matches.length > 0 && matches[activeMatchIndex]
    ? matches[activeMatchIndex].lineIndex
    : -1;

  // Set of lines containing at least one match for quick lookup
  const matchLineSet = useMemo(() => {
    const s = new Set();
    matches.forEach(m => s.add(m.lineIndex));
    return s;
  }, [matches]);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className={`html-source-viewer ${isExpanded ? 'source-viewer-expanded' : ''}`}>
      {/* Top Search & Actions Toolbar */}
      <div className="source-viewer-toolbar">
        {/* Left: Search Input & Occurrence Navigation */}
        <div className="source-search-group">
          <div className="source-search-input-box">
            <Search size={14} className="source-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar no HTML (ex: <button, id=, .container, texto)..."
              className="source-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-icon-subtle source-search-clear"
                onClick={() => {
                  setSearchQuery('');
                  if (searchInputRef.current) searchInputRef.current.focus();
                }}
                title="Limpar busca (Esc)"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Match counter & Next/Prev */}
          {searchQuery.trim() ? (
            <div className="source-matches-nav">
              <span className={`source-match-counter ${matches.length === 0 ? 'zero-matches' : ''}`}>
                {matches.length > 0 ? (
                  `${activeMatchIndex + 1} de ${matches.length}`
                ) : (
                  'Nenhuma ocorrência'
                )}
              </span>
              <button
                type="button"
                className="btn-icon-subtle source-nav-btn"
                onClick={handlePrevMatch}
                disabled={matches.length === 0}
                title="Ocorrência anterior (Shift+Enter)"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                className="btn-icon-subtle source-nav-btn"
                onClick={handleNextMatch}
                disabled={matches.length === 0}
                title="Próxima ocorrência (Enter)"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          ) : (
            <div className="source-stats-pill">
              <Layers size={12} />
              <span>{rawLines.length.toLocaleString()} linhas</span>
              <span>•</span>
              <span>{formatFileSize(rawHtml.length)}</span>
            </div>
          )}

          {/* Case sensitive toggle */}
          <button
            type="button"
            className={`btn-subtle-toggle ${caseSensitive ? 'active' : ''}`}
            onClick={() => setCaseSensitive(prev => !prev)}
            title="Diferenciar maiúsculas/minúsculas (Aa)"
          >
            Aa
          </button>
        </div>

        {/* Right: Refresh, Copy, Download, Expand */}
        <div className="source-actions-group">
          {onRefresh && (
            <button
              type="button"
              className="btn btn-secondary btn-sm source-action-btn"
              onClick={onRefresh}
              disabled={isLoading}
              title="Atualizar código fonte do navegador atual"
            >
              <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
              <span>Atualizar DOM</span>
            </button>
          )}

          <button
            type="button"
            className={`btn btn-secondary btn-sm source-action-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            disabled={!rawHtml}
            title="Copiar HTML completo para área de transferência"
          >
            {copied ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm source-action-btn"
            onClick={handleDownload}
            disabled={!rawHtml}
            title="Baixar arquivo HTML"
          >
            <Download size={13} />
            <span>Baixar .html</span>
          </button>

          <button
            type="button"
            className="btn-icon-subtle"
            onClick={() => setIsExpanded(prev => !prev)}
            title={isExpanded ? 'Restaurar visualização' : 'Expandir para tela cheia'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* URL & Page Metadata bar */}
      <div className="source-metadata-bar">
        <div className="source-url-indicator">
          <Globe size={12} color="var(--color-primary)" />
          <span className="source-url-text" title={url || 'about:blank'}>
            {url || 'about:blank'}
          </span>
          {title && (
            <span className="source-title-badge" title={title}>
              {title}
            </span>
          )}
        </div>
        <div className="source-lang-indicator">
          <Code size={12} />
          <span>HTML / DOM Serializado</span>
        </div>
      </div>

      {/* Code Content Container */}
      <div className="source-code-viewport" ref={containerRef}>
        {isLoading ? (
          <div className="source-loading-state">
            <RefreshCw className="spin" size={28} color="var(--color-primary)" />
            <p>Obtendo código fonte da página no Chromium...</p>
          </div>
        ) : !rawHtml ? (
          <div className="source-empty-state">
            <FileCode size={36} color="var(--text-dark)" />
            <p>Nenhum código fonte disponível no momento.</p>
            <span>Navegue para uma página no Sandbox e clique em "Atualizar DOM".</span>
          </div>
        ) : (
          <div className="source-code-lines-container">
            {highlightedLines.map((lineContent, lineIdx) => {
              const isMatchLine = matchLineSet.has(lineIdx);
              const isActiveMatch = lineIdx === activeLineIndex;

              return (
                <div
                  key={lineIdx}
                  ref={el => { lineRefs.current[lineIdx] = el; }}
                  className={`source-line-row ${isMatchLine ? 'line-has-match' : ''} ${isActiveMatch ? 'line-active-match' : ''}`}
                >
                  <span className="source-line-num">{lineIdx + 1}</span>
                  <span
                    className="source-line-text language-markup"
                    dangerouslySetInnerHTML={{ __html: lineContent || '&nbsp;' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
