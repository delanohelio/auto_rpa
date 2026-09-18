import React, { useState } from 'react';
import { XCircle, Download, Search } from 'lucide-react';
import CodeViewer from './CodeViewer';

export default function HtmlViewerModal({ html = '', title = 'Código HTML Capturado', onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `page_capture_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredHtml = React.useMemo(() => {
    if (!searchTerm.trim()) return html;
    const lines = html.split('\n');
    const matching = lines.filter(l => l.toLowerCase().includes(searchTerm.toLowerCase()));
    return `<!-- Exibindo ${matching.length} linhas contendo "${searchTerm}" -->\n` + matching.join('\n');
  }, [html, searchTerm]);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal-content" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
        <XCircle className="modal-close" size={24} onClick={onClose} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingRight: '32px' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>{title}</h3>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownload}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> Baixar HTML (.html)
          </button>
        </div>

        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="search-input-wrapper" style={{ maxWidth: '100%' }}>
            <Search className="search-input-icon" size={16} />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar tag, classe, texto ou seletor no HTML..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {searchTerm && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSearchTerm('')}
            >
              Limpar
            </button>
          )}
        </div>

        <CodeViewer
          code={filteredHtml}
          language="markup"
          maxHeight="60vh"
        />
      </div>
    </div>
  );
}
