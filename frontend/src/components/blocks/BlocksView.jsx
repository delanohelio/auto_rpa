import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Trash2,
  Edit2,
  Lock,
  Download,
  Upload,
  Link,
  Search,
  Bot,
  Code
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import BlockEditorModal from './BlockEditorModal';
import CodeViewer from '../code/CodeViewer';

export default function BlocksView({ initialEditingId, onClearInitialEditingId }) {
  const { blocks, saveBlock, deleteBlock } = useData();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [editingBlock, setEditingBlock] = useState(null);
  const [viewingJsonBlock, setViewingJsonBlock] = useState(null);

  // If redirected with deep link to edit a block
  React.useEffect(() => {
    if (initialEditingId) {
      const found = blocks.find(b => b.id === initialEditingId);
      if (found) {
        setEditingBlock(found);
      }
      onClearInitialEditingId?.();
    }
  }, [initialEditingId, blocks, onClearInitialEditingId]);

  const filteredBlocks = blocks.filter(b => {
    const q = search.toLowerCase();
    return b.name.toLowerCase().includes(q) || (b.description && b.description.toLowerCase().includes(q));
  });

  const handleExportBlock = (block) => {
    const blob = new Blob([JSON.stringify(block, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bloco_${block.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bloco Exportado', `Arquivo baixado com sucesso.`);
  };

  const handleImportBlock = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.name || !Array.isArray(parsed.steps)) {
          throw new Error('Formato de bloco inválido.');
        }
        delete parsed.id; // Generate a fresh ID
        parsed.name = `${parsed.name} (Importado)`;
        await saveBlock(parsed);
      } catch (err) {
        toast.error('Erro na Importação', err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyApiLink = (blockId) => {
    const url = `${window.location.origin}/api/blocks/${blockId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link Copiado', 'Endpoint da API copiado para a área de transferência.');
  };

  return (
    <div>
      <div className="header-section">
        <div>
          <h2>Blocos de Ação Reutilizáveis</h2>
          <p>Módulos de etapas e navegação atômica encadeáveis em pipelines</p>
        </div>

        <div className="gap-8" style={{ flexWrap: 'wrap' }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
            <Upload size={14} /> Importar Bloco
            <input type="file" accept=".json" onChange={handleImportBlock} style={{ display: 'none' }} />
          </label>
          <button
            className="btn btn-primary"
            onClick={() => setEditingBlock({ name: '', description: '', steps: [], secrets: {}, parameters: [] })}
          >
            <Plus size={14} /> Criar Bloco
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-search-bar">
        <div className="search-input-wrapper">
          <Search className="search-input-icon" size={16} />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar blocos por nome ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {filteredBlocks.length} {filteredBlocks.length === 1 ? 'bloco encontrado' : 'blocos encontrados'}
        </div>
      </div>

      {/* Blocks Grid / List */}
      {filteredBlocks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Boxes size={36} color="var(--text-dark)" style={{ margin: '0 auto 12px' }} />
          <p className="text-muted">
            {search ? 'Nenhum bloco corresponde à busca.' : 'Nenhum bloco cadastrado ainda.'}
          </p>
          {!search && (
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: '16px' }}
              onClick={() => setEditingBlock({ name: '', description: '', steps: [], secrets: {}, parameters: [] })}
            >
              <Plus size={12} /> Criar Primeiro Bloco
            </button>
          )}
        </div>
      ) : (
        <div className="list-wrapper">
          {filteredBlocks.map(block => {
            const hasAgentControl = (block.steps || []).some(s => s.type === 'agent_control');
            const secretsCount = Object.keys(block.secrets || {}).length;
            const paramsCount = (block.parameters || []).length;

            return (
              <div key={block.id} className="list-item">
                <div className="list-item-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3>{block.name}</h3>
                    {hasAgentControl && (
                      <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                        <Bot size={11} /> Handoff Agente
                      </span>
                    )}
                  </div>
                  <p>{block.description || 'Sem descrição informada.'}</p>
                </div>

                <div className="list-item-meta">
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-info">
                      {block.steps?.length || 0} etapas
                    </span>
                    {paramsCount > 0 && (
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                        {paramsCount} parâmetros
                      </span>
                    )}
                    {secretsCount > 0 && (
                      <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                        <Lock size={10} /> {secretsCount} secrets
                      </span>
                    )}
                  </div>

                  <div className="gap-8">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setViewingJsonBlock(block)}
                      title="Ver Código JSON do Bloco"
                    >
                      <Code size={13} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopyApiLink(block.id)}
                      title="Copiar URL da API"
                    >
                      <Link size={13} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleExportBlock(block)}
                      title="Exportar arquivo JSON"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingBlock(block)}
                      title="Editar Bloco"
                    >
                      <Edit2 size={13} /> Editar
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (window.confirm(`Deseja excluir o bloco "${block.name}"?`)) {
                          deleteBlock(block.id);
                        }
                      }}
                      title="Excluir Bloco"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {editingBlock && (
        <BlockEditorModal
          block={editingBlock}
          onSave={async (savedData) => {
            await saveBlock(savedData);
            setEditingBlock(null);
          }}
          onClose={() => setEditingBlock(null)}
        />
      )}

      {/* View JSON Modal */}
      {viewingJsonBlock && (
        <div className="modal-overlay" onClick={() => setViewingJsonBlock(null)} style={{ zIndex: 1200 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <CodeViewer
              code={viewingJsonBlock}
              language="json"
              title={`Definição JSON: ${viewingJsonBlock.name}`}
              maxHeight="60vh"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setViewingJsonBlock(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
