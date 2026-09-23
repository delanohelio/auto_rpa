import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Globe,
  Code,
  Camera,
  MousePointer,
  Type,
  Clock,
  ExternalLink,
  Eye,
  Sliders,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  CheckSquare,
  Sparkles,
  Monitor,
  Maximize2,
  Minimize2,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useData } from '../../context/DataContext';
import CodeEditor from '../code/CodeEditor';
import JsonViewer from '../code/JsonViewer';

export default function SandboxView({ initialBlock = null, onSavedBlock = null }) {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const { saveBlock } = useData();

  // Block Model State
  const [blockName, setBlockName] = useState(initialBlock?.name || 'Novo Bloco de Teste');
  const [blockDesc, setBlockDesc] = useState(initialBlock?.description || 'Testado e validado no Sandbox Studio');
  const [steps, setSteps] = useState(() => {
    if (initialBlock?.steps && initialBlock.steps.length > 0) {
      return JSON.parse(JSON.stringify(initialBlock.steps));
    }
    return [
      { type: 'navigate', url: 'https://example.com' },
      { type: 'eval', script: '(() => {\n  return { title: document.title, url: window.location.href };\n})()' }
    ];
  });

  // Test Parameter Values for resolving {{param}} placeholders in Sandbox
  const [testParams, setTestParams] = useState(() => {
    const p = {};
    if (initialBlock?.parameters) {
      initialBlock.parameters.forEach(param => {
        p[param.name] = param.defaultValue || '';
      });
    }
    return p;
  });
  const [showParamsDrawer, setShowParamsDrawer] = useState(false);

  // Browser & Session State
  const [isReady, setIsReady] = useState(false);
  const [headless, setHeadless] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('about:blank');
  const [pageTitle, setPageTitle] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [streamKey, setStreamKey] = useState(Date.now());

  // Execution States
  const [executingStepIndex, setExecutingStepIndex] = useState(null);
  const [stepResults, setStepResults] = useState({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isFullscreenStream, setIsFullscreenStream] = useState(false);

  // Save Modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize or connect to sandbox session
  const initSession = useCallback(async (desiredHeadless = headless) => {
    setIsInitializing(true);
    try {
      const res = await apiFetch('/api/sandbox/init', {
        method: 'POST',
        body: JSON.stringify({ headless: desiredHeadless })
      });
      if (res.ok) {
        const data = await res.json();
        setIsReady(true);
        setCurrentUrl(data.currentUrl || 'about:blank');
        setHeadless(data.headless ?? desiredHeadless);
        setStreamKey(Date.now());
        addConsoleLog('info', `Sessão do Sandbox iniciada (Modo: ${desiredHeadless ? 'Headless' : 'Headed'}).`);
      }
    } catch (err) {
      console.error('Failed to init sandbox:', err);
      toast.error('Erro no Sandbox', err.message);
    } finally {
      setIsInitializing(false);
    }
  }, [apiFetch, headless, toast]);

  // Check state on mount
  useEffect(() => {
    const checkState = async () => {
      try {
        const res = await apiFetch('/api/sandbox/state');
        if (res.ok) {
          const data = await res.json();
          if (data.isReady) {
            setIsReady(true);
            setCurrentUrl(data.currentUrl || 'about:blank');
            setPageTitle(data.title || '');
            setHeadless(data.headless ?? true);
            return;
          }
        }
        // If not ready, initialize
        await initSession(true);
      } catch (_) {
        await initSession(true);
      }
    };
    checkState();
  }, []);

  const addConsoleLog = (level, text, details = null) => {
    setConsoleLogs(prev => [
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        level,
        text,
        details
      },
      ...prev.slice(0, 49) // Keep last 50 logs
    ]);
  };

  // Reset Browser Session
  const handleResetSession = async () => {
    setIsResetting(true);
    try {
      const res = await apiFetch('/api/sandbox/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCurrentUrl(data.currentUrl || 'about:blank');
        setPageTitle('');
        setStreamKey(Date.now());
        setStepResults({});
        toast.info('Navegador Resetado', 'Sessão limpa e página retornada para about:blank.');
        addConsoleLog('info', 'Navegador resetado para about:blank.');
      }
    } catch (err) {
      toast.error('Erro ao Resetar', err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // Switch Headless / Headed mode
  const handleToggleHeadless = async () => {
    const nextMode = !headless;
    setHeadless(nextMode);
    toast.info('Alterando Modo', `Reiniciando Chromium em modo ${nextMode ? 'Headless' : 'Headed (Visual)'}...`);
    await initSession(nextMode);
  };

  // Step Management
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
    if (type === 'select') {
      newStep.selector = '';
      newStep.selector_type = 'id';
      newStep.value = '';
    }
    if (type === 'wait') {
      newStep.condition = 'time';
      newStep.timeout = 2;
    }
    if (type === 'keypress') {
      newStep.key = 'Enter';
    }
    if (type === 'eval') {
      newStep.script = '(() => {\n  return document.title;\n})()';
      newStep.output_file = '';
    }
    if (type === 'list_elements') {
      newStep.query_selector = '';
      newStep.selector_type = 'css';
    }
    if (type === 'screenshot') {
      newStep.name = 'captura_sandbox';
    }

    setSteps(prev => [...prev, newStep]);
  };

  const updateStep = (index, field, value) => {
    setSteps(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeStep = (index) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
    setStepResults(prev => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const moveStep = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    setSteps(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // Execute a single step in the live browser
  const handleExecuteStep = async (step, index) => {
    setExecutingStepIndex(index);
    try {
      addConsoleLog('info', `Executando Ação #${index + 1}: ${step.type}...`);
      const res = await apiFetch('/api/sandbox/execute-step', {
        method: 'POST',
        body: JSON.stringify({
          step,
          parameterOverrides: testParams,
          secrets: {}
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Falha ao executar ação');
      }

      setStepResults(prev => ({ ...prev, [index]: result }));
      if (result.currentUrl) setCurrentUrl(result.currentUrl);
      if (result.title) setPageTitle(result.title);

      if (result.success) {
        addConsoleLog('success', `Ação #${index + 1} (${step.type}) concluída em ${result.duration}ms`, result.data);
      } else {
        addConsoleLog('error', `Ação #${index + 1} (${step.type}) falhou: ${result.error}`);
      }

      return result;
    } catch (err) {
      const errResult = {
        type: step.type,
        success: false,
        error: err.message,
        duration: 0
      };
      setStepResults(prev => ({ ...prev, [index]: errResult }));
      addConsoleLog('error', `Ação #${index + 1} falhou com exceção: ${err.message}`);
      return errResult;
    } finally {
      setExecutingStepIndex(null);
    }
  };

  // Execute all steps in sequential order
  const handleExecuteAll = async () => {
    if (steps.length === 0) return;
    setIsRunningAll(true);
    addConsoleLog('info', `Iniciando execução em lote de ${steps.length} ações...`);

    for (let i = 0; i < steps.length; i++) {
      const result = await handleExecuteStep(steps[i], i);
      if (!result.success) {
        toast.error('Execução Interrompida', `Ação #${i + 1} (${steps[i].type}) falhou: ${result.error}`);
        break;
      }
    }

    setIsRunningAll(false);
  };

  // Direct Address Bar Navigation
  const [navBarUrl, setNavBarUrl] = useState(currentUrl);
  useEffect(() => {
    setNavBarUrl(currentUrl);
  }, [currentUrl]);

  const handleNavigateFromBar = async (e) => {
    e.preventDefault();
    if (!navBarUrl) return;
    const targetUrl = navBarUrl.startsWith('http') || navBarUrl.startsWith('about:') ? navBarUrl : `https://${navBarUrl}`;
    const tempStep = { type: 'navigate', url: targetUrl };
    await handleExecuteStep(tempStep, 'direct');
  };

  // Save as Block
  const handleSaveAsBlock = async () => {
    if (!blockName.trim()) {
      toast.error('Nome Obrigatório', 'Informe um nome para o bloco.');
      return;
    }

    setIsSaving(true);
    try {
      const blockPayload = {
        ...(initialBlock?.id ? { id: initialBlock.id } : {}),
        name: blockName.trim(),
        description: blockDesc.trim(),
        steps,
        parameters: initialBlock?.parameters || [],
        secrets: initialBlock?.secrets || {}
      };

      const saved = await saveBlock(blockPayload);
      setShowSaveModal(false);
      onSavedBlock?.(saved);
    } catch (err) {
      console.error('Failed to save block:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Stream URL with auth token if required
  const systemPassword = localStorage.getItem('systemPassword') || '';
  const streamUrl = `/api/sandbox/stream?t=${streamKey}${systemPassword ? `&token=${encodeURIComponent(systemPassword)}` : ''}`;

  return (
    <div className="sandbox-studio-container">
      {/* Top Header Bar */}
      <div className="sandbox-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sandbox-badge-logo">
            <FlaskConical size={18} color="#60a5fa" />
          </div>
          <div>
            <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Live Sandbox Studio
              <span className="badge" style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                Interativo
              </span>
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Teste ações em tempo real contra o navegador Chromium antes de consolidar seu bloco
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Headless Toggle */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleToggleHeadless}
            title={headless ? 'Chromium sem janela (Headless). Clique para abrir janela visual.' : 'Chromium com janela nativa aberta (Headed).'}
            style={{ fontSize: '12px', gap: '6px' }}
          >
            <Monitor size={14} color={headless ? 'var(--text-muted)' : '#c084fc'} />
            {headless ? 'Headless' : 'Headed (Com Janela)'}
          </button>

          {/* Parameters / Variables Drawer Toggle */}
          <button
            type="button"
            className={`btn btn-secondary btn-sm ${showParamsDrawer ? 'active' : ''}`}
            onClick={() => setShowParamsDrawer(prev => !prev)}
            title="Configurar variáveis de teste para interpolação {{param}}"
            style={{ fontSize: '12px', gap: '6px' }}
          >
            <Sliders size={14} />
            Variáveis de Teste
          </button>

          {/* Run All Button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExecuteAll}
            disabled={isRunningAll || steps.length === 0}
            style={{ color: 'var(--color-primary)', borderColor: 'rgba(59, 130, 246, 0.4)', fontSize: '12px', gap: '6px' }}
          >
            {isRunningAll ? (
              <>
                <RefreshCw className="spin" size={13} />
                Executando Sequência...
              </>
            ) : (
              <>
                <Play size={13} />
                Executar Todas ({steps.length})
              </>
            )}
          </button>

          {/* Save Block Button */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowSaveModal(true)}
            style={{ fontSize: '12px', gap: '6px' }}
          >
            <Save size={14} />
            Salvar Bloco
          </button>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="sandbox-main-layout">
        {/* ============================================================== */}
        {/* LEFT COLUMN: ACTION SEQUENCING & STEP CONFIGURATION            */}
        {/* ============================================================== */}
        <div className="sandbox-steps-column">
          {/* Block Metadata Bar */}
          <div className="sandbox-block-header">
            <input
              type="text"
              className="sandbox-title-input"
              value={blockName}
              onChange={e => setBlockName(e.target.value)}
              placeholder="Nome do Bloco de Ações..."
            />
            <input
              type="text"
              className="sandbox-desc-input"
              value={blockDesc}
              onChange={e => setBlockDesc(e.target.value)}
              placeholder="Descrição do objetivo destas ações..."
            />
          </div>

          {/* Variables Drawer (if toggled) */}
          {showParamsDrawer && (
            <div className="sandbox-params-drawer">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary)' }}>
                  Variáveis de Teste (Interpolação)
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Use {`{{chave}}`} nas ações abaixo
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(testParams).map(([k, val]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>{k}:</span>
                    <input
                      type="text"
                      value={val}
                      onChange={e => {
                        const nextVal = e.target.value;
                        setTestParams(prev => ({ ...prev, [k]: nextVal }));
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', width: '100px' }}
                    />
                  </div>
                ))}
                {/* Add new param inline */}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '10px', padding: '2px 8px' }}
                  onClick={() => {
                    const name = prompt('Nome da variável (ex: usuario, url_base):');
                    if (name && name.trim()) {
                      setTestParams(prev => ({ ...prev, [name.trim()]: '' }));
                    }
                  }}
                >
                  + Nova Variável
                </button>
              </div>
            </div>
          )}

          {/* Action Palette Bar */}
          <div className="sandbox-palette-bar">
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Adicionar Ação:
            </span>
            <div className="sandbox-palette-buttons">
              <button type="button" className="palette-btn" onClick={() => addStep('navigate')}>
                <Globe size={12} color="#60a5fa" /> + Navegar
              </button>
              <button type="button" className="palette-btn" onClick={() => addStep('click')}>
                <MousePointer size={12} color="#34d399" /> + Clicar
              </button>
              <button type="button" className="palette-btn" onClick={() => addStep('type')}>
                <Type size={12} color="#facc15" /> + Digitar
              </button>
              <button type="button" className="palette-btn" onClick={() => addStep('select')}>
                <CheckSquare size={12} color="#a78bfa" /> + Selecionar
              </button>
              <button type="button" className="palette-btn" onClick={() => addStep('wait')}>
                <Clock size={12} color="#f472b6" /> + Esperar
              </button>
              <button type="button" className="palette-btn" onClick={() => addStep('eval')}>
                <Code size={12} color="#38bdf8" /> + Executar JS
              </button>
              <button type="button" className="palette-btn" onClick={() => addStep('list_elements')}>
                <FileText size={12} color="#fbbf24" /> + Extrair Texto
              </button>
              <button type="button" className="palette-btn" onClick={() => addStep('screenshot')}>
                <Camera size={12} color="#e879f9" /> + Screenshot
              </button>
            </div>
          </div>

          {/* Steps List */}
          <div className="sandbox-steps-list">
            {steps.length === 0 ? (
              <div className="sandbox-empty-steps">
                <FlaskConical size={32} color="var(--text-dark)" />
                <p>Nenhuma ação adicionada nesta sequência de teste.</p>
                <span>Utilize os botões acima para adicionar uma ação e executá-la individualmente.</span>
              </div>
            ) : (
              steps.map((step, index) => {
                const isExecuting = executingStepIndex === index;
                const result = stepResults[index];

                return (
                  <div
                    key={index}
                    className={`sandbox-step-card ${isExecuting ? 'step-executing' : ''} ${result ? (result.success ? 'step-success' : 'step-failed') : ''}`}
                  >
                    {/* Step Card Header */}
                    <div className="step-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="step-card-index">{index + 1}</span>
                        <span className="step-type-badge">{step.type}</span>
                        {result && (
                          <span
                            className={`badge ${result.success ? 'badge-success' : 'badge-danger'}`}
                            style={{ fontSize: '10px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {result.success ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                            {result.success ? `${result.duration}ms` : 'Erro'}
                          </span>
                        )}
                      </div>

                      {/* Step Actions */}
                      <div className="step-card-actions">
                        {/* Execute Action Button (Requirement 1.3 & 1.4) */}
                        <button
                          type="button"
                          className="btn-step-run"
                          onClick={() => handleExecuteStep(step, index)}
                          disabled={isExecuting || isRunningAll}
                          title="Executar apenas esta ação em tempo real no navegador"
                        >
                          {isExecuting ? (
                            <RefreshCw className="spin" size={13} />
                          ) : (
                            <Play size={13} fill="currentColor" />
                          )}
                          <span>Executar Ação</span>
                        </button>

                        {/* Move Up */}
                        <button
                          type="button"
                          className="btn-icon-subtle"
                          disabled={index === 0}
                          onClick={() => moveStep(index, -1)}
                          title="Mover para cima"
                        >
                          <ArrowUp size={13} />
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          className="btn-icon-subtle"
                          disabled={index === steps.length - 1}
                          onClick={() => moveStep(index, 1)}
                          title="Mover para baixo"
                        >
                          <ArrowDown size={13} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          className="btn-icon-subtle btn-danger-hover"
                          onClick={() => removeStep(index)}
                          title="Excluir ação"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Step Card Config Fields */}
                    <div className="step-card-body">
                      {/* Navigate */}
                      {step.type === 'navigate' && (
                        <div className="form-group mb-0">
                          <label style={{ fontSize: '11px' }}>URL de Destino</label>
                          <input
                            type="text"
                            className="form-control"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                            placeholder="https://exemplo.com ou {{url_param}}"
                            value={step.url || ''}
                            onChange={e => updateStep(index, 'url', e.target.value)}
                          />
                        </div>
                      )}

                      {/* Click */}
                      {step.type === 'click' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px' }}>Seletor do Elemento</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              placeholder="#botao-entrar ou .submit-btn"
                              value={step.selector || ''}
                              onChange={e => updateStep(index, 'selector', e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px' }}>Tipo de Seletor</label>
                            <select
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              value={step.selector_type || 'id'}
                              onChange={e => updateStep(index, 'selector_type', e.target.value)}
                            >
                              <option value="id">ID (#)</option>
                              <option value="css">CSS Seletor</option>
                              <option value="xpath">XPath</option>
                              <option value="name">Atributo name</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '11px' }}>Clique</label>
                            <select
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              value={step.click_type || 'single'}
                              onChange={e => updateStep(index, 'click_type', e.target.value)}
                            >
                              <option value="single">Clique Simples</option>
                              <option value="double">Duplo Clique</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Type */}
                      {step.type === 'type' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.5fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px' }}>Seletor do Campo</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              placeholder="#campo-email"
                              value={step.selector || ''}
                              onChange={e => updateStep(index, 'selector', e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px' }}>Tipo Seletor</label>
                            <select
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              value={step.selector_type || 'id'}
                              onChange={e => updateStep(index, 'selector_type', e.target.value)}
                            >
                              <option value="id">ID (#)</option>
                              <option value="css">CSS Seletor</option>
                              <option value="xpath">XPath</option>
                              <option value="name">Atributo name</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '11px' }}>Texto ou Valor {`{{param}}`}</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              placeholder="Digite o texto ou {{senha}}"
                              value={step.text || ''}
                              onChange={e => updateStep(index, 'text', e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Select Option */}
                      {step.type === 'select' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px' }}>Seletor do Select</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              placeholder="#meu-select"
                              value={step.selector || ''}
                              onChange={e => updateStep(index, 'selector', e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px' }}>Tipo Seletor</label>
                            <select
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              value={step.selector_type || 'id'}
                              onChange={e => updateStep(index, 'selector_type', e.target.value)}
                            >
                              <option value="id">ID (#)</option>
                              <option value="css">CSS Seletor</option>
                              <option value="xpath">XPath</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '11px' }}>Valor da Opção (value ou label)</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              placeholder="ex: SP ou Opção 1"
                              value={step.value || ''}
                              onChange={e => updateStep(index, 'value', e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Wait */}
                      {step.type === 'wait' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px' }}>Tipo de Espera</label>
                            <select
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              value={step.condition || 'time'}
                              onChange={e => updateStep(index, 'condition', e.target.value)}
                            >
                              <option value="time">Tempo Fixo (segundos)</option>
                              <option value="element">Elemento Ficar Visível</option>
                              <option value="load">Carregamento Completo (DOM)</option>
                            </select>
                          </div>

                          {step.condition === 'element' ? (
                            <div>
                              <label style={{ fontSize: '11px' }}>Seletor do Elemento</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: '12px', padding: '6px 10px' }}
                                placeholder="#conteudo-carregado"
                                value={step.selector || ''}
                                onChange={e => updateStep(index, 'selector', e.target.value)}
                              />
                            </div>
                          ) : (
                            <div />
                          )}

                          <div>
                            <label style={{ fontSize: '11px' }}>Segundos</label>
                            <input
                              type="number"
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              value={step.timeout ?? 2}
                              onChange={e => updateStep(index, 'timeout', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Keypress */}
                      {step.type === 'keypress' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px' }}>Tecla a Pressionar</label>
                            <select
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              value={step.key || 'Enter'}
                              onChange={e => updateStep(index, 'key', e.target.value)}
                            >
                              <option value="Enter">Enter</option>
                              <option value="Tab">Tab</option>
                              <option value="Escape">Escape</option>
                              <option value="ArrowDown">Seta para Baixo</option>
                              <option value="ArrowUp">Seta para Cima</option>
                              <option value="Backspace">Backspace</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Eval / JS Execution */}
                      {step.type === 'eval' && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontSize: '11px', margin: 0 }}>Script JavaScript de Avaliação</label>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              O que for retornado será exibido abaixo e no log
                            </span>
                          </div>
                          <CodeEditor
                            value={step.script || ''}
                            onChange={code => updateStep(index, 'script', code)}
                            language="javascript"
                            rows={4}
                            placeholder="(() => {\n  return document.title;\n})()"
                          />
                          <div style={{ marginTop: '6px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Salvar retorno em arquivo de download (opcional):
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: '11px', padding: '4px 8px' }}
                              placeholder="ex: relatorio.json"
                              value={step.output_file || ''}
                              onChange={e => updateStep(index, 'output_file', e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {/* List Elements / Extract Text */}
                      {step.type === 'list_elements' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px' }}>Seletor CSS dos Elementos</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              placeholder=".item-titulo ou table tbody tr"
                              value={step.query_selector || ''}
                              onChange={e => updateStep(index, 'query_selector', e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px' }}>Tipo</label>
                            <select
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              value={step.selector_type || 'css'}
                              onChange={e => updateStep(index, 'selector_type', e.target.value)}
                            >
                              <option value="css">CSS</option>
                              <option value="xpath">XPath</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Screenshot */}
                      {step.type === 'screenshot' && (
                        <div>
                          <label style={{ fontSize: '11px' }}>Nome da Captura</label>
                          <input
                            type="text"
                            className="form-control"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                            placeholder="ex: tela_inicial"
                            value={step.name || ''}
                            onChange={e => updateStep(index, 'name', e.target.value)}
                          />
                        </div>
                      )}

                      {/* Result Display for this Step */}
                      {result && (
                        <div className={`step-inline-result ${result.success ? 'result-success' : 'result-error'}`}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
                              {result.success ? (
                                <CheckCircle2 size={13} color="var(--color-success)" />
                              ) : (
                                <AlertCircle size={13} color="var(--color-danger)" />
                              )}
                              <span>{result.success ? 'Resultado da Ação:' : 'Falha na Execução:'}</span>
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {result.duration}ms
                            </span>
                          </div>

                          {result.error && (
                            <div style={{ fontSize: '11px', color: '#f87171', fontFamily: 'var(--font-mono)' }}>
                              {result.error}
                            </div>
                          )}

                          {result.data && (
                            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
                              {result.data.message && <div>{result.data.message}</div>}
                              {result.data.returnValue !== undefined && (
                                <div style={{ marginTop: '6px', background: 'rgba(0,0,0,0.4)', padding: '6px', borderRadius: '4px' }}>
                                  <div style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 600, marginBottom: '2px' }}>
                                    Retorno (Eval / Script):
                                  </div>
                                  <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'var(--font-mono)', maxHeight: '120px', overflowY: 'auto' }}>
                                    {typeof result.data.returnValue === 'object'
                                      ? JSON.stringify(result.data.returnValue, null, 2)
                                      : String(result.data.returnValue)}
                                  </pre>
                                </div>
                              )}
                              {Array.isArray(result.data.items) && (
                                <div style={{ marginTop: '4px', fontSize: '10px', color: '#facc15' }}>
                                  {result.data.items.length} itens extraídos da página
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: REAL-TIME BROWSER VIEW & CONTROL                 */}
        {/* ============================================================== */}
        <div className={`sandbox-browser-column ${isFullscreenStream ? 'browser-column-fullscreen' : ''}`}>
          {/* Address & Control Bar */}
          <div className="sandbox-address-bar">
            {/* Reset Browser Button (Requirement 1.5) */}
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-reset-browser"
              onClick={handleResetSession}
              disabled={isResetting}
              title="Resetar navegador para página em branco e limpar cookies"
            >
              <RotateCcw className={isResetting ? 'spin' : ''} size={14} color="#60a5fa" />
              <span>Resetar Navegador</span>
            </button>

            {/* URL Input Bar */}
            <form onSubmit={handleNavigateFromBar} style={{ flexGrow: 1, display: 'flex' }}>
              <div className="sandbox-url-input-container">
                <Globe size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  className="sandbox-url-input"
                  value={navBarUrl}
                  onChange={e => setNavBarUrl(e.target.value)}
                  placeholder="https://exemplo.com ou about:blank"
                />
                {pageTitle && (
                  <span className="sandbox-page-title-badge" title={pageTitle}>
                    {pageTitle}
                  </span>
                )}
              </div>
            </form>

            {/* Reload Stream */}
            <button
              type="button"
              className="btn-icon-subtle"
              onClick={() => setStreamKey(Date.now())}
              title="Recarregar transmissão ao vivo"
            >
              <RefreshCw size={14} />
            </button>

            {/* Fullscreen stream */}
            <button
              type="button"
              className="btn-icon-subtle"
              onClick={() => setIsFullscreenStream(prev => !prev)}
              title={isFullscreenStream ? 'Sair da tela cheia' : 'Expandir transmissão'}
            >
              {isFullscreenStream ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>

          {/* Real-Time Screencast Stream Viewport */}
          <div className="sandbox-viewport-wrapper">
            {isInitializing ? (
              <div className="sandbox-viewport-loading">
                <RefreshCw className="spin" size={32} color="var(--color-primary)" />
                <p>Iniciando sessão do Chromium...</p>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Aguardando conexão com CDP Screencast
                </span>
              </div>
            ) : (
              <div className="sandbox-viewport-screen">
                <img
                  src={streamUrl}
                  alt="Navegador em Tempo Real"
                  className="sandbox-stream-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextElementSibling) {
                      e.target.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
                <div className="sandbox-stream-placeholder" style={{ display: 'none' }}>
                  <Eye size={36} color="var(--text-dark)" />
                  <p>Aguardando primeiro quadro do navegador...</p>
                  <span>Execute uma ação de navegação para iniciar a visualização.</span>
                </div>
              </div>
            )}
          </div>

          {/* Real-time Session Activity Console */}
          <div className="sandbox-console-drawer">
            <div className="console-drawer-header">
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Console de Atividade & Retornos
              </span>
              <button
                type="button"
                className="btn-icon-subtle"
                style={{ fontSize: '10px' }}
                onClick={() => setConsoleLogs([])}
              >
                Limpar
              </button>
            </div>
            <div className="console-drawer-body">
              {consoleLogs.length === 0 ? (
                <div style={{ color: 'var(--text-dark)', fontSize: '11px', fontStyle: 'italic', padding: '8px' }}>
                  Nenhuma atividade registrada na sessão. Execute uma ação ao lado para acompanhar o fluxo.
                </div>
              ) : (
                consoleLogs.map(log => (
                  <div key={log.id} className={`console-log-row log-${log.level}`}>
                    <span className="log-time">{log.time}</span>
                    <span className="log-msg">{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Block Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)} style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Salvar Bloco de Ação</h3>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ fontSize: '13px', marginBottom: '14px' }}>
                Suas ações foram testadas com sucesso no Sandbox! Salve esta sequência como um Bloco reutilizável para compor pipelines.
              </p>
              <div className="form-group">
                <label>Nome do Bloco</label>
                <input
                  type="text"
                  className="form-control"
                  value={blockName}
                  onChange={e => setBlockName(e.target.value)}
                  placeholder="ex: Login e Coleta de Títulos"
                />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={blockDesc}
                  onChange={e => setBlockDesc(e.target.value)}
                  placeholder="Descreva o propósito deste bloco..."
                />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-primary)' }}>
                Total de ações prontas para salvar: <strong>{steps.length} etapas</strong>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAsBlock}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="spin" size={14} /> Salvando...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Salvar no Repositório
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
