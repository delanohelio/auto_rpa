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
  Code
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
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newParamName, setNewParamName] = useState('');
  const [newParamDefault, setNewParamDefault] = useState('');
  const [newParamDesc, setNewParamDesc] = useState('');

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
    setEditingBlock(prev => ({
      ...prev,
      secrets: { ...(prev.secrets || {}), [newSecretKey.trim()]: newSecretValue }
    }));
    setNewSecretKey('');
    setNewSecretValue('');
  };

  const handleRemoveSecret = (key) => {
    setEditingBlock(prev => {
      const next = { ...prev.secrets };
      delete next[key];
      return { ...prev, secrets: next };
    });
  };

  // Parameters operations
  const handleAddParam = () => {
    if (!newParamName.trim()) return;
    const cleanName = newParamName.trim().replace(/[^a-zA-Z0-9_]/g, '');
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

  const handleRemoveParam = (index) => {
    setEditingBlock(prev => ({
      ...prev,
      parameters: (prev.parameters || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingBlock.name.trim()) return;
    onSave(editingBlock);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
        <XCircle className="modal-close" size={24} onClick={onClose} />

        <h3 className="modal-title">
          {editingBlock.id ? `Editar Bloco: ${editingBlock.name}` : 'Criar Novo Bloco de Ações'}
        </h3>

        {/* Modal Navigation Sub-tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', paddingBottom: '10px' }}>
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

        <form onSubmit={handleSubmit}>
          {/* Main Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
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
            <div>
              {/* Step Type Quick Add Palette */}
              <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
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
                </div>
              </div>

              {/* Steps List */}
              <div className="steps-list" style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '4px' }}>
                {editingBlock.steps.length === 0 ? (
                  <p className="text-muted" style={{ padding: '30px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
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
                          <div style={{ gridColumn: 'span 2' }}>
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
                            <div style={{ gridColumn: 'span 2' }}>
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
                          <div>
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

                        {/* Eval Step with CodeEditor and Syntax Validation */}
                        {step.type === 'eval' && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ fontSize: '11px', display: 'block', marginBottom: '6px' }}>
                              Script JavaScript a Executar (Retorno síncrono avaliado na página)
                            </label>
                            <CodeEditor
                              value={step.script || ''}
                              onChange={val => updateStepField(index, 'script', val)}
                              language="javascript"
                              rows={5}
                            />
                            <div style={{ marginTop: '10px' }}>
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
                          <div style={{ gridColumn: 'span 2' }}>
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
                          <div style={{ gridColumn: 'span 2', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
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
                          <div style={{ gridColumn: 'span 2', color: 'var(--text-muted)', fontSize: '12px' }}>
                            Captura o código-fonte HTML completo da página e registra no log com suporte a download e busca.
                          </div>
                        )}
                        {step.type === 'screenshot' && (
                          <div style={{ gridColumn: 'span 2', color: 'var(--text-muted)', fontSize: '12px' }}>
                            Registra uma captura de tela visual no histórico da execução.
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PARAMETERS */}
          {activeTab === 'params' && (
            <div>
              <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                Declare parâmetros com valor padrão. No corpo das etapas do bloco, use a sintaxe <code style={{ color: 'var(--color-secondary)' }}>{'{{param:nome}}'}</code>.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr auto', gap: '10px', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Nome do Parâmetro</label>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(editingBlock.parameters || []).map((param, pIdx) => (
                  <div
                    key={pIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--color-secondary)' }}>{'{{param:' + param.name + '}}'}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '12px', fontSize: '12px' }}>
                        Padrão: "{param.defaultValue}" {param.description ? `• ${param.description}` : ''}
                      </span>
                    </div>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveParam(pIdx)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SECRETS */}
          {activeTab === 'secrets' && (
            <div>
              <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                Variáveis criptografadas no banco via <strong>AES-256-CBC</strong>. Nas etapas, use <code style={{ color: 'var(--color-secondary)' }}>{'{{secret:chave}}'}</code>. O valor é descriptografado apenas em memória na execução e mascarado nos logs.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Chave do Secret</label>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(editingBlock.secrets || {}).map(([key, val]) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{'{{secret:' + key + '}}'}</span>
                      <span style={{ color: 'var(--text-dark)', marginLeft: '12px', fontSize: '12px' }}>●●●●●●●● (Protegido)</span>
                    </div>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveSecret(key)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: JSON PREVIEW */}
          {activeTab === 'json' && (
            <CodeViewer
              code={editingBlock}
              language="json"
              title={`Schema do Bloco: ${editingBlock.name || 'Novo Bloco'}`}
              maxHeight="50vh"
            />
          )}

          {/* Actions Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
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
