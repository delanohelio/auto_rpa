import React, { useState } from 'react';
import {
  XCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Workflow,
  Shield,
  Code
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import CodeViewer from '../code/CodeViewer';

export default function TaskEditorModal({ task, onSave, onClose }) {
  const { blocks } = useData();

  const [editingTask, setEditingTask] = useState(() => {
    return JSON.parse(JSON.stringify(task || {
      name: '',
      description: '',
      blocks: [],
      antiDetection: true
    }));
  });

  const [selectedBlockToAdd, setSelectedBlockToAdd] = useState('');
  const [activeTab, setActiveTab] = useState('flow'); // 'flow' | 'json'

  const handleAddBlockToFlow = () => {
    if (!selectedBlockToAdd) return;
    const targetBlock = blocks.find(b => b.id === selectedBlockToAdd);
    if (!targetBlock) return;

    const newInstance = {
      id: crypto.randomUUID ? crypto.randomUUID() : `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      blockId: targetBlock.id,
      parameterValues: {}
    };

    setEditingTask(prev => ({
      ...prev,
      blocks: [...(prev.blocks || []), newInstance]
    }));
    setSelectedBlockToAdd('');
  };

  const handleRemoveInstance = (index) => {
    setEditingTask(prev => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== index)
    }));
  };

  const handleMoveInstance = (index, direction) => {
    setEditingTask(prev => {
      const nextBlocks = [...prev.blocks];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= nextBlocks.length) return prev;
      const temp = nextBlocks[index];
      nextBlocks[index] = nextBlocks[targetIndex];
      nextBlocks[targetIndex] = temp;
      return { ...prev, blocks: nextBlocks };
    });
  };

  const handleUpdateParamOverride = (instanceId, paramName, value) => {
    setEditingTask(prev => {
      const nextBlocks = prev.blocks.map(inst => {
        if (inst.id === instanceId) {
          return {
            ...inst,
            parameterValues: {
              ...(inst.parameterValues || {}),
              [paramName]: value
            }
          };
        }
        return inst;
      });
      return { ...prev, blocks: nextBlocks };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingTask.name.trim()) return;
    if (!editingTask.blocks || editingTask.blocks.length === 0) {
      alert('Adicione pelo menos um bloco de ação na sequência da pipeline.');
      return;
    }
    onSave(editingTask);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '880px' }} onClick={e => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            {editingTask.id ? `Editar Pipeline: ${editingTask.name}` : 'Montar Nova Pipeline (Tarefa)'}
          </h3>
          <XCircle className="modal-close" size={24} onClick={onClose} />

          {/* Modal Navigation Sub-tabs */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'flow' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('flow')}
            >
              Fluxo da Pipeline ({editingTask.blocks?.length || 0} blocos)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'json' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('json')}
            >
              <Code size={12} /> Visualizar JSON Schema
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="modal-body">
            {activeTab === 'flow' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Task Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Nome da Pipeline *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: Coleta Notícias e Envia"
                      value={editingTask.name}
                      onChange={e => setEditingTask({ ...editingTask, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Descrição</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: Acessa portal, raspa tabela e tira screenshot"
                      value={editingTask.description || ''}
                      onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                    />
                  </div>
                </div>

                {/* Anti-Detection Option */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    background: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <input
                    type="checkbox"
                    id="antiDetectionCheckbox"
                    checked={editingTask.antiDetection !== false}
                    onChange={e => setEditingTask({ ...editingTask, antiDetection: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="antiDetectionCheckbox" style={{ margin: 0, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="var(--color-secondary)" />
                    <strong>Ativar Modo Anti-Detecção</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      (Oculta navigator.webdriver, mascara flags de automação e bypassa Cloudflare/bot detectors)
                    </span>
                  </label>
                </div>

                {/* Add Block to Pipeline Control */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <select
                    className="form-control"
                    style={{ flexGrow: 1 }}
                    value={selectedBlockToAdd}
                    onChange={e => setSelectedBlockToAdd(e.target.value)}
                  >
                    <option value="">-- Selecione um bloco de ação para adicionar ao fluxo --</option>
                    {blocks.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.steps?.length || 0} etapas)
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddBlockToFlow}
                    disabled={!selectedBlockToAdd}
                  >
                    <Plus size={14} /> Adicionar Bloco
                  </button>
                </div>

                {/* Interactive Flow Sequence (No nested scroll limits) */}
                <div>
                  {(!editingTask.blocks || editingTask.blocks.length === 0) ? (
                    <p className="text-muted" style={{ padding: '36px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                      Nenhum bloco encadeado ainda. Selecione um bloco acima e clique em "Adicionar Bloco".
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {editingTask.blocks.map((instance, index) => {
                        const block = blocks.find(b => b.id === instance.blockId);
                        const params = block?.parameters || [];

                        return (
                          <div
                            key={instance.id || index}
                            style={{
                              padding: '16px',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-md)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: params.length > 0 ? '12px' : 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: 'var(--color-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    fontWeight: 700
                                  }}
                                >
                                  {index + 1}
                                </span>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                    {block ? block.name : 'Bloco não encontrado (removido)'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {block ? `${block.steps?.length || 0} etapas internas` : ''}
                                  </div>
                                </div>
                              </div>

                              <div className="gap-8">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleMoveInstance(index, -1)}
                                  disabled={index === 0}
                                  title="Mover para cima"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleMoveInstance(index, 1)}
                                  disabled={index === editingTask.blocks.length - 1}
                                  title="Mover para baixo"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleRemoveInstance(index)}
                                  title="Remover do fluxo"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Parameters configuration */}
                            {params.length > 0 && (
                              <div
                                style={{
                                  background: 'rgba(0, 0, 0, 0.2)',
                                  padding: '12px 14px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border-color)'
                                }}
                              >
                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                  Parâmetros Específicos para esta Etapa da Pipeline:
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                                  {params.map((param, pIdx) => {
                                    const currentVal = instance.parameterValues?.[param.name] ?? '';
                                    return (
                                      <div key={pIdx}>
                                        <label style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                          <span style={{ color: 'var(--color-secondary)' }}>{param.name}</span>
                                          <span style={{ color: 'var(--text-dark)', fontSize: '10px' }}>
                                            (Padrão: {param.defaultValue})
                                          </span>
                                        </label>
                                        <input
                                          type="text"
                                          className="form-control"
                                          style={{ fontSize: '12px', padding: '6px 10px' }}
                                          placeholder={param.defaultValue ? `Valor padrão: ${param.defaultValue}` : 'Defina um valor'}
                                          value={currentVal}
                                          onChange={e => handleUpdateParamOverride(instance.id, param.name, e.target.value)}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <CodeViewer
                code={editingTask}
                language="json"
                title={`Schema da Pipeline: ${editingTask.name || 'Nova Pipeline'}`}
                maxHeight="60vh"
              />
            )}
          </div>

          {/* Fixed Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar Pipeline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
