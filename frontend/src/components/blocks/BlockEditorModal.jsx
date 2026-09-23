import React, { useState } from 'react';
import {
  XCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  Boxes,
  HelpCircle,
  Eye,
  Bot,
  Sparkles,
  Code,
  Edit2,
  Check,
  X,
  Shield,
  MousePointerClick
} from 'lucide-react';
import CodeEditor from '../code/CodeEditor';
import CodeViewer from '../code/CodeViewer';

export default function BlockEditorModal({ block, onSave, onClose }) {
  const [editingBlock, setEditingBlock] = useState(() => {
    return JSON.parse(JSON.stringify(block || {
      name: '',
      description: '',
      steps: [],
      secrets: {},
      parameters: []
    }));
  });

  const [activeTab, setActiveTab] = useState('steps'); // 'steps' | 'params' | 'secrets' | 'json'

  // Secrets states
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [editingSecretKey, setEditingSecretKey] = useState(null);
  const [editSecretKeyInput, setEditSecretKeyInput] = useState('');
  const [editSecretValInput, setEditSecretValInput] = useState('');
  const [secretKeyRenames, setSecretKeyRenames] = useState({});

  // Parameters states
  const [newParamName, setNewParamName] = useState('');
  const [newParamDefault, setNewParamDefault] = useState('');
  const [newParamDesc, setNewParamDesc] = useState('');
  const [editingParamIndex, setEditingParamIndex] = useState(null);
  const [editParamName, setEditParamName] = useState('');
  const [editParamDefault, setEditParamDefault] = useState('');
  const [editParamDesc, setEditParamDesc] = useState('');

  // Step operations
  const addStep = (type) => {
    const newStep = { type };
    if (type === 'navigate') newStep.url = 'https://';
    if (type === 'click') {
      newStep.selector = '';
      newStep.selector_type = 'id';
      newStep.click_type = 'single';
    }
    if (type === 'type') {
      newStep.selector = '';
      newStep.selector_type = 'id';
      newStep.text = '';
    }
    if (type === 'wait') {
      newStep.condition = 'load';
      newStep.selector = '';
      newStep.selector_type = 'id';
      newStep.timeout = 30;
    }
    if (type === 'keypress') newStep.key = 'Enter';
    if (type === 'list_elements') {
      newStep.query_selector = '';
      newStep.selector_type = 'css';
    }
    if (type === 'conditional_if') {
      newStep.selector_type = 'id';
      newStep.selector_exists = '';
    }
    if (type === 'eval') {
      newStep.script = '(() => {\n  return document.title;\n})()';
      newStep.output_file = '';
    }
    if (type === 'agent_control') {
      newStep.acquireTimeout = 300;
      newStep.executionTimeout = 120;
    }
    if (type === 'user_prompt') {
      newStep.acquireTimeout = 1800;
      newStep.promptTitle = '';
      newStep.promptDescription = '';
      newStep.vars = [{ name: 'param1', label: 'Campo 1', defaultValue: '' }];
      newStep.dynamic_script = '';
    }
    if (type === 'manual_interaction') {
      newStep.instruction = 'Realize as ações necessárias com o mouse e teclado na janela do navegador e depois clique em Continuar.';
      newStep.timeout = 600;
    }

    setEditingBlock(prev => ({
      ...prev,
      steps: [...(prev.steps || []), newStep]
    }));
  };

  const updateStepField = (index, field, value) => {
    setEditingBlock(prev => {
      const nextSteps = [...prev.steps];
      nextSteps[index] = { ...nextSteps[index], [field]: value };
      return { ...prev, steps: nextSteps };
    });
  };

  const removeStep = (index) => {
    setEditingBlock(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const moveStep = (index, direction) => {
    setEditingBlock(prev => {
      const newSteps = [...prev.steps];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= newSteps.length) return prev;
      const temp = newSteps[index];
      newSteps[index] = newSteps[targetIndex];
      newSteps[targetIndex] = temp;
      return { ...prev, steps: newSteps };
    });
  };

  // Secrets operations
  const handleAddSecret = () => {
    if (!newSecretKey.trim()) return;
    const cleanKey = newSecretKey.trim();
    setEditingBlock(prev => ({
      ...prev,
      secrets: { ...(prev.secrets || {}), [cleanKey]: newSecretValue }
    }));
    setNewSecretKey('');
    setNewSecretValue('');
  };

  const handleStartEditSecret = (key) => {
    setEditingSecretKey(key);
    setEditSecretKeyInput(key);
    setEditSecretValInput(''); // empty means keep existing encrypted value
  };

  const handleCancelEditSecret = () => {
    setEditingSecretKey(null);
    setEditSecretKeyInput('');
    setEditSecretValInput('');
  };

  const handleSaveEditSecret = (originalKey) => {
    const cleanKey = editSecretKeyInput.trim();
    if (!cleanKey) return;

    setEditingBlock(prev => {
      const nextSecrets = { ...(prev.secrets || {}) };
      const currentVal = nextSecrets[originalKey];
      // If user typed a new password value, use it. Otherwise retain current (e.g. '********')
      const finalVal = editSecretValInput.trim() !== '' ? editSecretValInput : currentVal;

      if (cleanKey !== originalKey) {
        delete nextSecrets[originalKey];
      }
      nextSecrets[cleanKey] = finalVal;
      return { ...prev, secrets: nextSecrets };
    });

    if (cleanKey !== originalKey) {
      setSecretKeyRenames(prev => {
        const origSource = prev[originalKey] || originalKey;
        const next = { ...prev };
        delete next[originalKey];
        next[cleanKey] = origSource;
        return next;
      });
    }

    setEditingSecretKey(null);
    setEditSecretKeyInput('');
    setEditSecretValInput('');
  };

  const handleRemoveSecret = (key) => {
    setEditingBlock(prev => {
      const next = { ...prev.secrets };
      delete next[key];
      return { ...prev, secrets: next };
    });
    setSecretKeyRenames(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (editingSecretKey === key) {
      handleCancelEditSecret();
    }
  };

  // Parameters operations
  const handleAddParam = () => {
    if (!newParamName.trim()) return;
    const cleanName = newParamName.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanName) return;

    setEditingBlock(prev => ({
      ...prev,
      parameters: [
        ...(prev.parameters || []),
        { name: cleanName, defaultValue: newParamDefault, description: newParamDesc }
      ]
    }));
    setNewParamName('');
    setNewParamDefault('');
    setNewParamDesc('');
  };

  const handleStartEditParam = (index) => {
    const param = editingBlock.parameters[index];
    if (!param) return;
    setEditingParamIndex(index);
    setEditParamName(param.name || '');
    setEditParamDefault(param.defaultValue || '');
    setEditParamDesc(param.description || '');
  };

  const handleCancelEditParam = () => {
    setEditingParamIndex(null);
    setEditParamName('');
    setEditParamDefault('');
    setEditParamDesc('');
  };

  const handleSaveEditParam = (index) => {
    const cleanName = editParamName.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanName) return;

    setEditingBlock(prev => {
      const next = [...(prev.parameters || [])];
      next[index] = {
        name: cleanName,
        defaultValue: editParamDefault,
        description: editParamDesc
      };
      return { ...prev, parameters: next };
    });

    setEditingParamIndex(null);
    setEditParamName('');
    setEditParamDefault('');
    setEditParamDesc('');
  };

  const handleRemoveParam = (index) => {
    setEditingBlock(prev => ({
      ...prev,
      parameters: (prev.parameters || []).filter((_, i) => i !== index)
    }));
    if (editingParamIndex === index) {
      handleCancelEditParam();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingBlock.name.trim()) return;
    onSave({
      ...editingBlock,
      secretKeyRenames
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '920px' }} onClick={e => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            {editingBlock.id ? `Editar Bloco: ${editingBlock.name}` : 'Criar Novo Bloco de Ações'}
          </h3>
          <XCircle className="modal-close" size={24} onClick={onClose} />

          {/* Modal Navigation Sub-tabs */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'steps' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('steps')}
            >
              Etapas ({editingBlock.steps?.length || 0})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'params' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('params')}
            >
              Parâmetros ({editingBlock.parameters?.length || 0})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'secrets' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('secrets')}
            >
              <Lock size={12} /> Secrets ({Object.keys(editingBlock.secrets || {}).length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'json' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('json')}
            >
              <Code size={12} /> Visualizar JSON
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="modal-body">
            {/* Main Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Nome do Bloco *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Fazer Login no Painel"
                  value={editingBlock.name}
                  onChange={e => setEditingBlock({ ...editingBlock, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Descrição do Bloco</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Acessa e autentica com credenciais"
                  value={editingBlock.description || ''}
                  onChange={e => setEditingBlock({ ...editingBlock, description: e.target.value })}
                />
              </div>
            </div>

            {/* TAB 1: STEPS */}
            {activeTab === 'steps' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Step Type Quick Add Palette */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    + Adicionar Ação à Sequência:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep('navigate')}>+ Navegar</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep('click')}>+ Clicar</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep('type')}>+ Digitar</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep('wait')}>+ Esperar</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep('keypress')}>+ Tecla</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep('extract_html')}>+ HTML</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep('list_elements')}>+ Listar Nós</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep('screenshot')}>+ Screenshot</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStep('conditional_if')}>+ Condicional (Se)</button>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }} onClick={() => addStep('eval')}>
                      <Sparkles size={12} /> + JS (Eval)
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' }} onClick={() => addStep('user_prompt')}>
                      <HelpCircle size={12} /> + Prompt Interativo
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ borderColor: '#a855f7', color: '#c084fc' }} onClick={() => addStep('agent_control')}>
                      <Bot size={12} /> + Handoff Agente
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ borderColor: 'rgba(192, 132, 252, 0.5)', color: '#c084fc', background: 'rgba(168, 85, 247, 0.08)' }} onClick={() => addStep('manual_interaction')}>
                      <MousePointerClick size={12} /> + Interação Manual
                    </button>
                  </div>
                </div>

                {/* Steps List (Flows smoothly within modal-body) */}
                <div className="steps-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {editingBlock.steps.length === 0 ? (
                    <p className="text-muted" style={{ padding: '36px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                      Nenhuma etapa adicionada. Use os botões acima para incluir ações no bloco.
                    </p>
                  ) : (
                    editingBlock.steps.map((step, index) => (
                      <div key={index} className="step-card">
                        <div className="step-header">
                          <h4>
                            <span style={{ color: 'var(--color-secondary)' }}>#{index + 1}</span>
                            <span style={{ textTransform: 'capitalize' }}>
                              {step.type === 'navigate' && 'Navegar para URL'}
                              {step.type === 'click' && 'Clicar no Elemento'}
                              {step.type === 'type' && 'Digitar / Preencher Texto'}
                              {step.type === 'wait' && 'Aguardar Condição'}
                              {step.type === 'keypress' && 'Pressionar Tecla'}
                              {step.type === 'extract_html' && 'Extrair Código HTML'}
                              {step.type === 'list_elements' && 'Listar Elementos DOM'}
                              {step.type === 'screenshot' && 'Tirar Screenshot da Tela'}
                              {step.type === 'conditional_if' && 'Seletor Condicional (Se existir)'}
                              {step.type === 'eval' && 'Executar Javascript (Eval)'}
                              {step.type === 'agent_control' && 'Handoff para Agente de IA'}
                              {step.type === 'user_prompt' && 'Prompt Interativo de Variáveis'}
                              {step.type === 'manual_interaction' && 'Interação Manual do Usuário (Mouse / Teclado)'}
                            </span>
                          </h4>

                          <div className="gap-8">
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                              <ArrowUp size={12} />
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveStep(index, 1)} disabled={index === editingBlock.steps.length - 1}>
                              <ArrowDown size={12} />
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => removeStep(index)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="step-body">
                          {step.type === 'navigate' && (
                            <div className="step-col-full">
                              <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>URL de Destino</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="https://exemplo.com (aceita {{param:nome}})"
                                value={step.url || ''}
                                onChange={e => updateStepField(index, 'url', e.target.value)}
                                required
                              />
                            </div>
                          )}

                          {step.type === 'click' && (
                            <>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tipo de Seletor</label>
                                <select
                                  className="form-control"
                                  value={step.selector_type || 'id'}
                                  onChange={e => updateStepField(index, 'selector_type', e.target.value)}
                                >
                                  <option value="id">ID do Elemento</option>
                                  <option value="class">Classe CSS</option>
                                  <option value="text">Texto Literal</option>
                                  <option value="xpath">XPath</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Seletor do Botão / Elemento</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder={step.selector_type === 'xpath' ? "//button[@type='submit']" : "login-btn ou .submit"}
                                  value={step.selector || ''}
                                  onChange={e => updateStepField(index, 'selector', e.target.value)}
                                  required
                                />
                              </div>
                            </>
                          )}

                          {step.type === 'type' && (
                            <>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Localizar Campo Por</label>
                                <select
                                  className="form-control"
                                  value={step.selector_type || 'id'}
                                  onChange={e => updateStepField(index, 'selector_type', e.target.value)}
                                >
                                  <option value="id">ID ou CSS Selector</option>
                                  <option value="label">Texto da Label</option>
                                  <option value="placeholder">Texto do Placeholder</option>
                                  <option value="xpath">XPath</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Seletor do Campo</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="username, E-mail ou //input"
                                  value={step.selector || ''}
                                  onChange={e => updateStepField(index, 'selector', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="step-col-full">
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Texto a Digitar (use {'{{secret:chave}}'} ou {'{{param:nome}}'})</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="meu_usuario ou {{secret:minha_senha}}"
                                  value={step.text || ''}
                                  onChange={e => updateStepField(index, 'text', e.target.value)}
                                  required
                                />
                              </div>
                            </>
                          )}

                          {step.type === 'wait' && (
                            <>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Condição de Espera</label>
                                <select
                                  className="form-control"
                                  value={step.condition || 'load'}
                                  onChange={e => updateStepField(index, 'condition', e.target.value)}
                                >
                                  <option value="load">Carregamento Completo (load)</option>
                                  <option value="networkidle">Rede Ociosa (networkidle)</option>
                                  <option value="visible">Elemento Visível no DOM</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tempo Limite (Timeout em Segundos)</label>
                                <input
                                  type="number"
                                  className="form-control"
                                  min={1}
                                  max={300}
                                  value={step.timeout || 30}
                                  onChange={e => updateStepField(index, 'timeout', parseInt(e.target.value, 10) || 30)}
                                />
                              </div>
                              {step.condition === 'visible' && (
                                <>
                                  <div>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tipo de Seletor</label>
                                    <select
                                      className="form-control"
                                      value={step.selector_type || 'id'}
                                      onChange={e => updateStepField(index, 'selector_type', e.target.value)}
                                    >
                                      <option value="id">ID ou CSS Selector</option>
                                      <option value="xpath">XPath</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Seletor a Aguardar</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="#resultado ou //div[contains(@class, 'modal')]"
                                      value={step.selector || ''}
                                      onChange={e => updateStepField(index, 'selector', e.target.value)}
                                      required
                                    />
                                  </div>
                                </>
                              )}
                            </>
                          )}

                          {step.type === 'keypress' && (
                            <div className="step-col-full">
                              <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tecla do Teclado</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Enter, Tab, Escape, ArrowDown..."
                                value={step.key || ''}
                                onChange={e => updateStepField(index, 'key', e.target.value)}
                                required
                              />
                            </div>
                          )}

                          {step.type === 'list_elements' && (
                            <>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tipo de Seletor</label>
                                <select
                                  className="form-control"
                                  value={step.selector_type || 'css'}
                                  onChange={e => updateStepField(index, 'selector_type', e.target.value)}
                                >
                                  <option value="css">Seletor CSS</option>
                                  <option value="xpath">XPath</option>
                                  <option value="id">ID</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Query Selector</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="table.results tr, .item-card"
                                  value={step.query_selector || ''}
                                  onChange={e => updateStepField(index, 'query_selector', e.target.value)}
                                  required
                                />
                              </div>
                            </>
                          )}

                          {step.type === 'conditional_if' && (
                            <>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tipo de Seletor</label>
                                <select
                                  className="form-control"
                                  value={step.selector_type || 'id'}
                                  onChange={e => updateStepField(index, 'selector_type', e.target.value)}
                                >
                                  <option value="id">ID</option>
                                  <option value="css">Classe / CSS</option>
                                  <option value="xpath">XPath</option>
                                  <option value="text">Texto Literal</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Seletor a Verificar Existência</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="#alerta-sucesso, //div[contains(text(), 'Erro')]"
                                  value={step.selector_exists || ''}
                                  onChange={e => updateStepField(index, 'selector_exists', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="step-col-full" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Se o elemento for localizado, a próxima etapa é executada normalmente. Se não existir, a próxima etapa é ignorada (skip).
                              </div>
                            </>
                          )}

                          {/* Eval Step with CodeEditor and Syntax Validation */}
                          {step.type === 'eval' && (
                            <div className="step-col-full">
                              <label style={{ fontSize: '11px', display: 'block', marginBottom: '6px' }}>
                                Script JavaScript a Executar (Retorno avaliado em página e salvo no histórico)
                              </label>
                              <CodeEditor
                                value={step.script || ''}
                                onChange={val => updateStepField(index, 'script', val)}
                                language="javascript"
                                rows={6}
                              />
                              <div style={{ marginTop: '12px' }}>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Salvar Saída em Arquivo (Opcional)</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Ex: resultado.csv (deixe em branco se não quiser gravar arquivo em disco)"
                                  value={step.output_file || ''}
                                  onChange={e => updateStepField(index, 'output_file', e.target.value)}
                                />
                              </div>
                            </div>
                          )}

                          {/* Interactive Prompt Step */}
                          {step.type === 'user_prompt' && (
                            <div className="step-col-full">
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div>
                                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Título do Modal de Preenchimento</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ex: Informe a Turma e Código"
                                    value={step.promptTitle || ''}
                                    onChange={e => updateStepField(index, 'promptTitle', e.target.value)}
                                    required
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tempo Limite para Preenchimento (Segundos)</label>
                                  <input
                                    type="number"
                                    className="form-control"
                                    min={10}
                                    max={86400}
                                    value={step.acquireTimeout || 1800}
                                    onChange={e => updateStepField(index, 'acquireTimeout', parseInt(e.target.value, 10) || 1800)}
                                  />
                                </div>
                              </div>

                              <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '6px' }}>
                                  Script JS Dinâmico de Extração (Opcional - Lê opções ou selects da página em tempo real)
                                </label>
                                <CodeEditor
                                  value={step.dynamic_script || ''}
                                  onChange={val => updateStepField(index, 'dynamic_script', val)}
                                  language="javascript"
                                  placeholder="// Ex: (() => { const opts = Array.from(document.querySelectorAll('select option')).map(o => ({ value: o.value, text: o.innerText.trim() })); return { options_for_campo: opts }; })()"
                                  rows={4}
                                />
                              </div>
                            </div>
                          )}

                          {/* Agent Control */}
                          {step.type === 'agent_control' && (
                            <div className="step-col-full" style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#c084fc', fontWeight: 600 }}>
                                <Bot size={16} /> Handoff de Controle para Agente de IA
                              </div>
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                                A pipeline pausará nesta etapa mantendo a aba do navegador aberta. Um agente externo pode se conectar via API REST (/api/agent/acquire), interagir e devolver o controle (/api/agent/release).
                              </p>
                            </div>
                          )}

                          {/* Screenshot / HTML extract */}
                          {step.type === 'extract_html' && (
                            <div className="step-col-full" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                              Captura o código-fonte HTML completo da página e registra no log com suporte a download e busca.
                            </div>
                          )}
                          {step.type === 'screenshot' && (
                            <div className="step-col-full" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                              Registra uma captura de tela visual no histórico da execução.
                            </div>
                          )}

                          {/* Manual Interaction (Requirement 1 & 1.1) */}
                          {step.type === 'manual_interaction' && (
                            <div className="step-col-full" style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c084fc', fontWeight: 600, fontSize: '13px' }}>
                                  <MousePointerClick size={16} /> Interação Manual do Usuário
                                </div>
                                <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.4)', fontSize: '11px' }}>
                                  Força Navegador Visual (Headed)
                                </span>
                              </div>
                              <div style={{ marginBottom: '10px' }}>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Instruções para o Operador</label>
                                <textarea
                                  className="form-control"
                                  rows={2}
                                  placeholder="ex: Resolva o captcha / complete o login na janela do navegador e depois clique em Continuar"
                                  value={step.instruction || step.message || ''}
                                  onChange={e => {
                                    updateStepField(index, 'instruction', e.target.value);
                                    updateStepField(index, 'message', e.target.value);
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Timeout Máximo de Espera (segundos, 0 = sem limite)</label>
                                <input
                                  type="number"
                                  className="form-control"
                                  placeholder="600"
                                  value={step.timeout ?? 600}
                                  onChange={e => updateStepField(index, 'timeout', parseFloat(e.target.value) || 0)}
                                />
                              </div>
                              <div style={{ marginTop: '8px', fontSize: '11px', color: '#a78bfa' }}>
                                💡 Ao atingir esta etapa durante o pipeline, a execução pausará e o navegador Playwright abrirá com janela visível na tela. O operador poderá interagir livremente com mouse/teclado e, ao terminar, clicar no botão "Continuar".
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: PARAMETERS (With Inline Edit) */}
            {activeTab === 'params' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p className="text-muted" style={{ fontSize: '13px', margin: 0 }}>
                  Declare parâmetros dinâmicos para o bloco. Nas etapas, acesse os valores com a sintaxe <code style={{ color: 'var(--color-secondary)' }}>{'{{param:nome}}'}</code>.
                </p>

                {/* Form to add new parameter */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr auto', gap: '10px', alignItems: 'flex-end', background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div>
                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Novo Parâmetro</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="termo_busca"
                      value={newParamName}
                      onChange={e => setNewParamName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Valor Padrão</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Tecnologia"
                      value={newParamDefault}
                      onChange={e => setNewParamDefault(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Descrição</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Texto a ser pesquisado"
                      value={newParamDesc}
                      onChange={e => setNewParamDesc(e.target.value)}
                    />
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={handleAddParam}>
                    <Plus size={14} /> Adicionar
                  </button>
                </div>

                {/* Parameters list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(editingBlock.parameters || []).length === 0 ? (
                    <p className="text-muted" style={{ padding: '28px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                      Nenhum parâmetro declarado ainda.
                    </p>
                  ) : (
                    editingBlock.parameters.map((param, pIdx) => {
                      const isEditing = editingParamIndex === pIdx;
                      if (isEditing) {
                        return (
                          <div
                            key={pIdx}
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
                              Editando Parâmetro #{pIdx + 1}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr auto', gap: '8px', alignItems: 'center' }}>
                              <div>
                                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px', color: 'var(--text-muted)' }}>Nome</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={editParamName}
                                  onChange={e => setEditParamName(e.target.value)}
                                  placeholder="nome_param"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px', color: 'var(--text-muted)' }}>Valor Padrão</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={editParamDefault}
                                  onChange={e => setEditParamDefault(e.target.value)}
                                  placeholder="Valor padrão"
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px', color: 'var(--text-muted)' }}>Descrição</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={editParamDesc}
                                  onChange={e => setEditParamDesc(e.target.value)}
                                  placeholder="Descrição opcional"
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleSaveEditParam(pIdx)}
                                  title="Salvar alterações"
                                >
                                  <Check size={13} /> Salvar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={handleCancelEditParam}
                                  title="Cancelar edição"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={pIdx}
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
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--color-secondary)' }}>{'{{param:' + param.name + '}}'}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '12px', fontSize: '12px' }}>
                              Padrão: "{param.defaultValue}" {param.description ? `• ${param.description}` : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStartEditParam(pIdx)}
                              title="Editar este parâmetro"
                            >
                              <Edit2 size={12} /> Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveParam(pIdx)}
                              title="Excluir parâmetro"
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
            )}

            {/* TAB 3: SECRETS (With Inline Edit & Rename) */}
            {activeTab === 'secrets' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p className="text-muted" style={{ fontSize: '13px', margin: 0 }}>
                  Variáveis criptografadas no banco via <strong>AES-256-CBC</strong>. Nas etapas, use <code style={{ color: 'var(--color-secondary)' }}>{'{{secret:chave}}'}</code>. O valor é descriptografado apenas em memória na execução e mascarado nos logs.
                </p>

                {/* Form to add new secret */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', alignItems: 'flex-end', background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div>
                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Nova Chave do Secret</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="senha_banco"
                      value={newSecretKey}
                      onChange={e => setNewSecretKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Valor Seguro</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Valor confidencial..."
                      value={newSecretValue}
                      onChange={e => setNewSecretValue(e.target.value)}
                    />
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={handleAddSecret}>
                    <Plus size={14} /> Salvar Secret
                  </button>
                </div>

                {/* Secrets list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(editingBlock.secrets || {}).length === 0 ? (
                    <p className="text-muted" style={{ padding: '28px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                      Nenhum secret registrado ainda.
                    </p>
                  ) : (
                    Object.entries(editingBlock.secrets || {}).map(([key, val]) => {
                      const isEditing = editingSecretKey === key;
                      if (isEditing) {
                        return (
                          <div
                            key={key}
                            style={{
                              padding: '12px 14px',
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: 'var(--radius-md)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>
                              Editando Secret: {key}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '8px', alignItems: 'center' }}>
                              <div>
                                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px', color: 'var(--text-muted)' }}>Chave</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={editSecretKeyInput}
                                  onChange={e => setEditSecretKeyInput(e.target.value)}
                                  placeholder="chave_do_secret"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px', color: 'var(--text-muted)' }}>
                                  Novo Valor (ou deixe em branco para manter protegido)
                                </label>
                                <input
                                  type="password"
                                  className="form-control"
                                  value={editSecretValInput}
                                  onChange={e => setEditSecretValInput(e.target.value)}
                                  placeholder="Deixar em branco para manter valor original"
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleSaveEditSecret(key)}
                                  title="Salvar alterações"
                                >
                                  <Check size={13} /> Salvar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={handleCancelEditSecret}
                                  title="Cancelar edição"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={key}
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
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{'{{secret:' + key + '}}'}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '12px', fontSize: '12px' }}>
                              ●●●●●●●● (Protegido e Criptografado)
                            </span>
                            {secretKeyRenames[key] && (
                              <span style={{ color: 'var(--color-secondary)', marginLeft: '8px', fontSize: '11px' }}>
                                (Renomeado de "{secretKeyRenames[key]}")
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStartEditSecret(key)}
                              title="Editar chave ou atualizar valor deste secret"
                            >
                              <Edit2 size={12} /> Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveSecret(key)}
                              title="Remover secret"
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
            )}

            {/* TAB 4: JSON PREVIEW */}
            {activeTab === 'json' && (
              <CodeViewer
                code={editingBlock}
                language="json"
                title={`Schema do Bloco: ${editingBlock.name || 'Novo Bloco'}`}
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
              Salvar Bloco de Ação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
