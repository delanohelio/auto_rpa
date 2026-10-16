import React, { useState } from 'react';
import {
  XCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Workflow,
  Shield,
  Code,
  Variable,
  Check,
  X,
  Edit2
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import CodeViewer from '../code/CodeViewer';
import {
  VARIABLE_TYPES,
  formatBrazilianNow,
  parseOptionsList,
  formatOptionsToText
} from '../../utils/variableTypes';
import TypedVariableInput from '../common/TypedVariableInput';

export default function TaskEditorModal({ task, onSave, onClose }) {
  const { blocks } = useData();

  const [editingTask, setEditingTask] = useState(() => {
    return JSON.parse(JSON.stringify(task || {
      name: '',
      description: '',
      blocks: [],
      executionVariables: [],
      antiDetection: true
    }));
  });

  const [selectedBlockToAdd, setSelectedBlockToAdd] = useState('');
  const [activeTab, setActiveTab] = useState('flow'); // 'flow' | 'vars' | 'json'

  // Execution variables state
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState('text');
  const [newVarOptions, setNewVarOptions] = useState('');
  const [newVarDefault, setNewVarDefault] = useState('');
  const [newVarDesc, setNewVarDesc] = useState('');

  const [editingVarIndex, setEditingVarIndex] = useState(null);
  const [editVarName, setEditVarName] = useState('');
  const [editVarType, setEditVarType] = useState('text');
  const [editVarOptions, setEditVarOptions] = useState('');
  const [editVarDefault, setEditVarDefault] = useState('');
  const [editVarDesc, setEditVarDesc] = useState('');

  const handleNewVarTypeChange = (type) => {
    setNewVarType(type);
    if (type === 'date' || type === 'datetime') {
      setNewVarDefault(formatBrazilianNow(type));
    } else if (type === 'number') {
      setNewVarDefault(0);
    } else if (type === 'multiselect') {
      setNewVarDefault([]);
    } else {
      setNewVarDefault('');
    }
  };

  const handleEditVarTypeChange = (type) => {
    setEditVarType(type);
    if (type === 'date' || type === 'datetime') {
      setEditVarDefault(formatBrazilianNow(type));
    } else if (type === 'number') {
      setEditVarDefault(0);
    } else if (type === 'multiselect') {
      setEditVarDefault([]);
    } else {
      setEditVarDefault('');
    }
  };

  const handleAddExecutionVar = () => {
    if (!newVarName.trim()) return;
    const cleanName = newVarName.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanName) return;

    const parsedOptions = (newVarType === 'select' || newVarType === 'multiselect')
      ? parseOptionsList(newVarOptions)
      : [];

    setEditingTask(prev => ({
      ...prev,
      executionVariables: [
        ...(prev.executionVariables || []),
        {
          name: cleanName,
          type: newVarType || 'text',
          options: parsedOptions,
          defaultValue: newVarDefault,
          description: newVarDesc
        }
      ]
    }));
    setNewVarName('');
    setNewVarType('text');
    setNewVarOptions('');
    setNewVarDefault('');
    setNewVarDesc('');
  };

  const handleStartEditVar = (index) => {
    const v = editingTask.executionVariables?.[index];
    if (!v) return;
    setEditingVarIndex(index);
    setEditVarName(v.name || '');
    setEditVarType(v.type || 'text');
    setEditVarOptions(formatOptionsToText(v.options || []));
    setEditVarDefault(v.defaultValue !== undefined ? v.defaultValue : '');
    setEditVarDesc(v.description || '');
  };

  const handleCancelEditVar = () => {
    setEditingVarIndex(null);
    setEditVarName('');
    setEditVarType('text');
    setEditVarOptions('');
    setEditVarDefault('');
    setEditVarDesc('');
  };

  const handleSaveEditVar = (index) => {
    const cleanName = editVarName.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanName) return;

    const parsedOptions = (editVarType === 'select' || editVarType === 'multiselect')
      ? parseOptionsList(editVarOptions)
      : [];

    setEditingTask(prev => {
      const next = [...(prev.executionVariables || [])];
      next[index] = {
        name: cleanName,
        type: editVarType || 'text',
        options: parsedOptions,
        defaultValue: editVarDefault,
        description: editVarDesc
      };
      return { ...prev, executionVariables: next };
    });

    setEditingVarIndex(null);
    setEditVarName('');
    setEditVarType('text');
    setEditVarOptions('');
    setEditVarDefault('');
    setEditVarDesc('');
  };

  const handleRemoveExecutionVar = (index) => {
    setEditingTask(prev => ({
      ...prev,
      executionVariables: (prev.executionVariables || []).filter((_, i) => i !== index)
    }));
    if (editingVarIndex === index) {
      handleCancelEditVar();
    }
  };

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
              className={`btn btn-sm ${activeTab === 'vars' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('vars')}
            >
              <Variable size={13} /> Variáveis de Execução ({editingTask.executionVariables?.length || 0})
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
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                                  {params.map((param, pIdx) => {
                                    const currentVal = instance.parameterValues?.[param.name] ?? '';
                                    return (
                                      <div key={pIdx}>
                                        <label style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                          <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>{param.name}</span>
                                          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                            ({param.type || 'text'}{param.defaultValue !== undefined && param.defaultValue !== '' ? `: ${param.defaultValue}` : ''})
                                          </span>
                                        </label>
                                        <TypedVariableInput
                                          type={param.type || 'text'}
                                          value={currentVal}
                                          onChange={val => handleUpdateParamOverride(instance.id, param.name, val)}
                                          options={param.options}
                                          placeholder={param.defaultValue !== undefined && param.defaultValue !== '' ? String(param.defaultValue) : 'Defina um valor'}
                                          size="sm"
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
            ) : activeTab === 'vars' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-light)', lineHeight: '1.5' }}>
                    💡 <strong>Variáveis Globais de Execução:</strong> São instanciadas ao iniciar a execução da pipeline. Qualquer etapa JavaScript (ação eval) de qualquer bloco pode atribuir e ler valores nessas variáveis em tempo real (ex: <code style={{ color: '#93c5fd' }}>vars.contador = (vars.contador || 0) + 1;</code> ou <code style={{ color: '#93c5fd' }}>return vars.meu_dado;</code>).
                  </p>
                </div>

                {/* Form to add execution variable */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 1.5fr auto', gap: '10px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Nome da Variável *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="total_itens"
                        value={newVarName}
                        onChange={e => setNewVarName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tipo da Variável</label>
                      <select
                        className="form-control"
                        value={newVarType}
                        onChange={e => handleNewVarTypeChange(e.target.value)}
                      >
                        {VARIABLE_TYPES.map(vt => (
                          <option key={vt.value} value={vt.value}>{vt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Valor Inicial</label>
                      <TypedVariableInput
                        type={newVarType}
                        value={newVarDefault}
                        onChange={setNewVarDefault}
                        options={newVarOptions}
                        size="sm"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Descrição (Opcional)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Contador global"
                        value={newVarDesc}
                        onChange={e => setNewVarDesc(e.target.value)}
                      />
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={handleAddExecutionVar} style={{ height: '36px' }}>
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>

                  {(newVarType === 'select' || newVarType === 'multiselect') && (
                    <div style={{ marginTop: '4px', borderTop: '1px dashed rgba(255, 255, 255, 0.08)', paddingTop: '8px' }}>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px', color: 'var(--color-primary)' }}>
                        Opções do {newVarType === 'multiselect' ? 'Multi Seleção' : 'Seletor'} (uma opção por linha)
                      </label>
                      <textarea
                        className="form-control"
                        rows={3}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                        placeholder={"Opção 1\nOpção 2\nOpção 3"}
                        value={newVarOptions}
                        onChange={e => setNewVarOptions(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Execution variables list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(editingTask.executionVariables || []).length === 0 ? (
                    <p className="text-muted" style={{ padding: '28px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                      Nenhuma variável de execução declarada para esta pipeline.
                    </p>
                  ) : (
                    editingTask.executionVariables.map((v, vIdx) => {
                      const isEditing = editingVarIndex === vIdx;
                      if (isEditing) {
                        return (
                          <div
                            key={vIdx}
                            style={{
                              padding: '12px 14px',
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: 'var(--radius-md)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary)' }}>
                              Editando Variável #{vIdx + 1}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 1.5fr auto', gap: '8px', alignItems: 'flex-end' }}>
                              <div>
                                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px', color: 'var(--text-muted)' }}>Nome</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={editVarName}
                                  onChange={e => setEditVarName(e.target.value)}
                                  placeholder="nome_variavel"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px', color: 'var(--text-muted)' }}>Tipo</label>
                                <select
                                  className="form-control"
                                  value={editVarType}
                                  onChange={e => handleEditVarTypeChange(e.target.value)}
                                >
                                  {VARIABLE_TYPES.map(vt => (
                                    <option key={vt.value} value={vt.value}>{vt.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px', color: 'var(--text-muted)' }}>Valor Inicial</label>
                                <TypedVariableInput
                                  type={editVarType}
                                  value={editVarDefault}
                                  onChange={setEditVarDefault}
                                  options={editVarOptions}
                                  size="sm"
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px', color: 'var(--text-muted)' }}>Descrição</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={editVarDesc}
                                  onChange={e => setEditVarDesc(e.target.value)}
                                  placeholder="Descrição opcional"
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleSaveEditVar(vIdx)}
                                  title="Salvar alterações"
                                >
                                  <Check size={13} /> Salvar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={handleCancelEditVar}
                                  title="Cancelar edição"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>

                            {(editVarType === 'select' || editVarType === 'multiselect') && (
                              <div style={{ marginTop: '6px', borderTop: '1px dashed rgba(59, 130, 246, 0.2)', paddingTop: '6px' }}>
                                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px', color: 'var(--color-primary)' }}>
                                  Opções (uma por linha)
                                </label>
                                <textarea
                                  className="form-control"
                                  rows={3}
                                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                                  value={editVarOptions}
                                  onChange={e => setEditVarOptions(e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      }

                      const varType = v.type || 'text';
                      const typeObj = VARIABLE_TYPES.find(t => t.value === varType);
                      const displayDefault = Array.isArray(v.defaultValue)
                        ? `[${v.defaultValue.join(', ')}]`
                        : String(v.defaultValue ?? '');

                      return (
                        <div
                          key={vIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-secondary)' }}>{'vars.' + v.name}</span>
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#93c5fd',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                fontWeight: 600
                              }}
                            >
                              {typeObj?.label || varType}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                              Inicial: "{displayDefault}"
                              {v.options?.length > 0 && ` • (${v.options.length} opções)`}
                              {v.description ? ` • ${v.description}` : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStartEditVar(vIdx)}
                              title="Editar esta variável"
                            >
                              <Edit2 size={12} /> Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveExecutionVar(vIdx)}
                              title="Excluir variável"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
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
