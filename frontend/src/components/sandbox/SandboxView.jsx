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
  EyeOff,
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
  FileText,
  Boxes,
  Workflow,
  Lock,
  FolderInput,
  Key,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useData } from '../../context/DataContext';
import CodeEditor from '../code/CodeEditor';
import JsonViewer from '../code/JsonViewer';

export default function SandboxView({ initialData = null, onClearInitialData = null, onSavedBlock = null }) {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const { blocks, tasks, saveBlock } = useData();

  // Block / Pipeline Model State
  const [sourceType, setSourceType] = useState('custom'); // 'custom' | 'block' | 'pipeline'
  const [blockName, setBlockName] = useState('Novo Bloco de Teste');
  const [blockDesc, setBlockDesc] = useState('Testado e validado no Sandbox Studio');
  const [steps, setSteps] = useState([]);
  const [collapsedSteps, setCollapsedSteps] = useState({});

  // Test Variables & Secrets State
  const [testParams, setTestParams] = useState({});
  const [testSecrets, setTestSecrets] = useState({});
  const [revealedSecrets, setRevealedSecrets] = useState({});
  const [showVariablesDrawer, setShowVariablesDrawer] = useState(false);
  const [activeVariablesTab, setActiveVariablesTab] = useState('params'); // 'params' | 'secrets'

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

  // Modals & Import State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importModalTab, setImportModalTab] = useState('pipelines'); // 'pipelines' | 'blocks'
  const [pendingImport, setPendingImport] = useState(null);

  const stepRefs = useRef({});
  const lastProcessedInitialDataRef = useRef(null);

  const addConsoleLog = useCallback((level, text, details = null) => {
    setConsoleLogs(prev => [
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        level,
        text,
        details
      },
      ...prev.slice(0, 49)
    ]);
  }, []);

  // Auto-scroll to active running step
  useEffect(() => {
    if (executingStepIndex !== null && stepRefs.current[executingStepIndex]) {
      try {
        stepRefs.current[executingStepIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (_) {}
    }
  }, [executingStepIndex]);

  // Extract steps, params and secrets from Pipeline or Block source
  const extractSourceData = useCallback((source) => {
    if (!source || !source.data) return null;

    if (source.type === 'pipeline') {
      const pipeline = source.data;
      const extractedSteps = [];
      const extractedParams = {};
      const extractedSecrets = {};

      const instances = pipeline.blocks || [];
      instances.forEach((instance, blockIdx) => {
        const blkId = instance.blockId || instance;
        const blk = blocks.find(b => b.id === blkId);
        if (!blk) return;

        // Collect parameters
        (blk.parameters || []).forEach(p => {
          extractedParams[p.name] = instance.parameterValues?.[p.name] ?? p.defaultValue ?? '';
        });

        // Collect secrets
        Object.keys(blk.secrets || {}).forEach(sKey => {
          extractedSecrets[sKey] = '';
        });

        // Collect steps with source tracking
        (blk.steps || []).forEach((st, sIdx) => {
          extractedSteps.push({
            ...JSON.parse(JSON.stringify(st)),
            sourceBlockName: blk.name,
            sourceBlockId: blk.id,
            sourceBlockIndex: blockIdx + 1,
            sourceStepIndex: sIdx + 1
          });

          // Also collect interactive prompt variables
          if (st.type === 'user_prompt' && Array.isArray(st.vars)) {
            st.vars.forEach(v => {
              if (v.name && extractedParams[v.name] === undefined) {
                extractedParams[v.name] = v.defaultValue || '';
              }
            });
          }
        });
      });

      return {
        type: 'pipeline',
        name: pipeline.name,
        title: `Pipeline: ${pipeline.name}`,
        description: pipeline.description || 'Sequência importada da pipeline para depuração',
        steps: extractedSteps,
        params: extractedParams,
        secrets: extractedSecrets
      };
    } else if (source.type === 'block') {
      const block = source.data;
      const extractedSteps = (block.steps || []).map((st, idx) => ({
        ...JSON.parse(JSON.stringify(st)),
        sourceBlockName: block.name,
        sourceBlockId: block.id,
        sourceStepIndex: idx + 1
      }));

      const extractedParams = {};
      (block.parameters || []).forEach(p => {
        extractedParams[p.name] = p.defaultValue || '';
      });

      const extractedSecrets = {};
      Object.keys(block.secrets || {}).forEach(sKey => {
        extractedSecrets[sKey] = '';
      });

      (block.steps || []).forEach(st => {
        if (st.type === 'user_prompt' && Array.isArray(st.vars)) {
          st.vars.forEach(v => {
            if (v.name && extractedParams[v.name] === undefined) {
              extractedParams[v.name] = v.defaultValue || '';
            }
          });
        }
      });

      return {
        type: 'block',
        name: block.name,
        title: block.name || 'Bloco Importado',
        description: block.description || 'Importado para teste no Sandbox',
        steps: extractedSteps,
        params: extractedParams,
        secrets: extractedSecrets
      };
    }

    return null;
  }, [blocks]);

  // Apply parsed import data according to mode ('replace' | 'prepend' | 'append')
  const applyImport = useCallback((parsed, mode) => {
    if (!parsed) return;

    if (mode === 'replace') {
      setSourceType(parsed.type);
      setBlockName(parsed.title);
      setBlockDesc(parsed.description);
      setSteps(parsed.steps);
      setTestParams(parsed.params);
      setTestSecrets(parsed.secrets);
      setStepResults({});
      setCollapsedSteps({});
      addConsoleLog('info', `${parsed.type === 'pipeline' ? 'Pipeline' : 'Bloco'} "${parsed.name}" importado (${parsed.steps.length} ações substituídas).`);
      toast.success('Ações Importadas', `Substituídas ${parsed.steps.length} ações no Studio.`);
    } else if (mode === 'prepend') {
      setSteps(prev => [...parsed.steps, ...prev]);
      setTestParams(prev => ({ ...prev, ...parsed.params }));
      setTestSecrets(prev => ({ ...prev, ...parsed.secrets }));
      setCollapsedSteps({});
      addConsoleLog('info', `${parsed.steps.length} ações de "${parsed.name}" inseridas no início.`);
      toast.success('Ações Adicionadas no Início', `${parsed.steps.length} ações inseridas antes das existentes.`);
    } else if (mode === 'append') {
      setSteps(prev => [...prev, ...parsed.steps]);
      setTestParams(prev => ({ ...prev, ...parsed.params }));
      setTestSecrets(prev => ({ ...prev, ...parsed.secrets }));
      setCollapsedSteps({});
      addConsoleLog('info', `${parsed.steps.length} ações de "${parsed.name}" adicionadas ao final.`);
      toast.success('Ações Adicionadas ao Final', `${parsed.steps.length} ações anexadas após as existentes.`);
    }

    setPendingImport(null);
    setShowImportModal(false);
    if (onClearInitialData) onClearInitialData();
  }, [addConsoleLog, toast, onClearInitialData]);

  // Request import: checks if studio already has actions
  const requestImport = useCallback((source) => {
    const parsed = extractSourceData(source);
    if (!parsed) return;

    // Requirement 2.1: se não tiver nenhuma ação no studio, importar diretamente;
    if (steps.length === 0) {
      applyImport(parsed, 'replace');
    } else {
      // Requirement 2: perguntar se quer substituir, adicionar no início ou adicionar no final
      setPendingImport(parsed);
      setShowImportModal(false);
    }
  }, [steps.length, extractSourceData, applyImport]);

  // Load initialData when passed (e.g. from BlocksView or TasksView) without loops
  useEffect(() => {
    if (initialData && initialData !== lastProcessedInitialDataRef.current) {
      lastProcessedInitialDataRef.current = initialData;
      const parsed = extractSourceData(initialData);
      if (parsed) {
        if (steps.length === 0) {
          applyImport(parsed, 'replace');
        } else {
          setPendingImport(parsed);
        }
      }
      if (onClearInitialData) {
        onClearInitialData();
      }
    }
  }, [initialData, extractSourceData, steps.length, applyImport, onClearInitialData]);

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
  }, [apiFetch, headless, toast, addConsoleLog]);

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
        await initSession(true);
      } catch (_) {
        await initSession(true);
      }
    };
    checkState();
  }, []);

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

  const toggleStepCollapse = (idx) => {
    setCollapsedSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const expandAllSteps = () => {
    setCollapsedSteps({});
  };

  const collapseAllSteps = () => {
    const all = {};
    steps.forEach((_, idx) => { all[idx] = true; });
    setCollapsedSteps(all);
  };

  const getStepSummary = (step) => {
    if (!step) return '';
    switch (step.type) {
      case 'navigate':
        return `Navegar: ${step.url || 'https://...'}`;
      case 'click':
        return `Clicar: ${step.selector || 'sem seletor'} (${step.selector_type || 'id'}, ${step.click_type || 'single'})`;
      case 'type': {
        const preview = step.text ? (step.text.length > 25 ? `${step.text.substring(0, 25)}...` : step.text) : 'vazio';
        return `Digitar em ${step.selector || 'campo'}: "${preview}"`;
      }
      case 'select':
        return `Selecionar em ${step.selector || 'select'}: "${step.value || ''}"`;
      case 'wait':
        return `Aguardar: ${step.condition === 'element' ? `elemento ${step.selector}` : `${step.timeout || 2}s`}`;
      case 'keypress':
        return `Tecla: ${step.key || 'Enter'}`;
      case 'eval': {
        const firstLine = (step.script || '').split('\n')[0].trim();
        return `Executar JS: ${firstLine ? (firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine) : 'script'}`;
      }
      case 'dynamic_script':
        return `Script Dinâmico`;
      case 'list_elements':
        return `Listar: ${step.query_selector || 'elementos'}`;
      case 'screenshot':
        return `Screenshot: ${step.name || 'captura'}`;
      case 'conditional_if':
        return `Condição se existe: ${step.selector_exists || step.selector || ''}`;
      case 'extract_html':
        return `Extrair HTML${step.selector ? ` de ${step.selector}` : ' da página'}`;
      case 'user_prompt':
        return `Prompt: ${step.message || 'Variáveis'}`;
      case 'agent_control':
        return `Handoff IA: ${(step.instruction || '').substring(0, 30)}...`;
      default:
        return `Ação: ${step.type}`;
    }
  };

  // Execute a single step in the live browser
  const handleExecuteStep = async (step, index) => {
    setExecutingStepIndex(index);
    try {
      const stepLabel = step.sourceBlockName ? `[${step.sourceBlockName}] ${step.type}` : step.type;
      addConsoleLog('info', `Executando Ação #${typeof index === 'number' ? index + 1 : 'Direta'}: ${stepLabel}...`);

      const res = await apiFetch('/api/sandbox/execute-step', {
        method: 'POST',
        body: JSON.stringify({
          step,
          parameters: testParams,
          parameterOverrides: testParams,
          secrets: testSecrets
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Falha ao executar ação');
      }

      if (typeof index === 'number') {
        setStepResults(prev => ({ ...prev, [index]: result }));
      }
      if (result.currentUrl) setCurrentUrl(result.currentUrl);
      if (result.title) setPageTitle(result.title);

      if (result.success) {
        addConsoleLog('success', `Ação #${typeof index === 'number' ? index + 1 : 'Direta'} (${step.type}) concluída em ${result.duration}ms`, result.data);
      } else {
        addConsoleLog('error', `Ação #${typeof index === 'number' ? index + 1 : 'Direta'} (${step.type}) falhou: ${result.error}`);
      }

      return result;
    } catch (err) {
      const errResult = {
        type: step.type,
        success: false,
        error: err.message,
        duration: 0
      };
      if (typeof index === 'number') {
        setStepResults(prev => ({ ...prev, [index]: errResult }));
      }
      addConsoleLog('error', `Ação falhou com exceção: ${err.message}`);
      return errResult;
    } finally {
      setExecutingStepIndex(null);
    }
  };

  // Execute all steps sequentially
  const handleExecuteAll = async () => {
    if (steps.length === 0) return;
    setIsRunningAll(true);
    addConsoleLog('info', `Iniciando execução em lote de ${steps.length} ações...`);

    for (let i = 0; i < steps.length; i++) {
      const result = await handleExecuteStep(steps[i], i);
      if (!result.success) {
        const stepContext = steps[i].sourceBlockName ? ` do bloco "${steps[i].sourceBlockName}"` : '';
        toast.error('Execução Interrompida', `Ação #${i + 1} (${steps[i].type})${stepContext} falhou: ${result.error}`);
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
      // Clean steps from internal sandbox tracking properties
      const cleanedSteps = steps.map(st => {
        const copy = { ...st };
        delete copy.sourceBlockName;
        delete copy.sourceBlockId;
        delete copy.sourceBlockIndex;
        delete copy.sourceStepIndex;
        return copy;
      });

      // Construct parameters definition
      const savedParams = Object.keys(testParams).map(k => ({
        name: k,
        defaultValue: testParams[k],
        description: 'Parâmetro validado no Sandbox'
      }));

      // Construct secrets definition
      const savedSecrets = {};
      Object.keys(testSecrets).forEach(k => {
        savedSecrets[k] = testSecrets[k] || '********';
      });

      const blockPayload = {
        name: blockName.trim(),
        description: blockDesc.trim(),
        steps: cleanedSteps,
        parameters: savedParams,
        secrets: savedSecrets
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

  const toggleRevealSecret = (key) => {
    setRevealedSecrets(prev => ({ ...prev, [key]: !prev[key] }));
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
            <h2 style={{ fontSize: '15px', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Live Sandbox Studio
              <span className="badge" style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                {sourceType === 'pipeline' ? 'Pipeline Ativa' : sourceType === 'block' ? 'Bloco Ativo' : 'Livre'}
              </span>
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Teste e depure ações em tempo real contra o Chromium com decifragem do cofre
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Quick Import Modal Button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowImportModal(true)}
            title="Importar uma pipeline ou bloco existente para testar aqui"
            style={{ fontSize: '12px', gap: '6px' }}
          >
            <FolderInput size={14} color="#60a5fa" />
            Importar...
          </button>

          {/* Headless Toggle */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleToggleHeadless}
            title={headless ? 'Chromium sem janela (Headless). Clique para abrir janela visual.' : 'Chromium com janela nativa aberta (Headed).'}
            style={{ fontSize: '12px', gap: '6px' }}
          >
            <Monitor size={14} color={headless ? 'var(--text-muted)' : '#c084fc'} />
            {headless ? 'Headless' : 'Headed (Visual)'}
          </button>

          {/* Variables & Secrets Drawer Toggle */}
          <button
            type="button"
            className={`btn btn-secondary btn-sm ${showVariablesDrawer ? 'active' : ''}`}
            onClick={() => setShowVariablesDrawer(prev => !prev)}
            title="Editar variáveis e secrets para testar ações com interpolação"
            style={{
              fontSize: '12px',
              gap: '6px',
              background: showVariablesDrawer ? 'rgba(59, 130, 246, 0.2)' : undefined,
              borderColor: showVariablesDrawer ? 'var(--color-primary)' : undefined
            }}
          >
            <Sliders size={14} />
            Variáveis & Secrets ({Object.keys(testParams).length + Object.keys(testSecrets).length})
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
          {/* Block / Pipeline Metadata Bar */}
          <div className="sandbox-block-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {sourceType === 'pipeline' && (
                <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Workflow size={11} /> Pipeline
                </span>
              )}
              {sourceType === 'block' && (
                <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Boxes size={11} /> Bloco
                </span>
              )}
              <input
                type="text"
                className="sandbox-title-input"
                value={blockName}
                onChange={e => setBlockName(e.target.value)}
                placeholder="Nome do Bloco ou Pipeline..."
              />
            </div>
            <input
              type="text"
              className="sandbox-desc-input"
              value={blockDesc}
              onChange={e => setBlockDesc(e.target.value)}
              placeholder="Descrição do objetivo destas ações..."
            />
          </div>

          {/* Variables & Secrets Drawer (Requirement 3 & 4) */}
          {showVariablesDrawer && (
            <div className="sandbox-params-drawer">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className={`btn-subtle-tab ${activeVariablesTab === 'params' ? 'active' : ''}`}
                    onClick={() => setActiveVariablesTab('params')}
                    style={{ fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Sliders size={13} />
                    Variáveis ({Object.keys(testParams).length})
                  </button>
                  <button
                    type="button"
                    className={`btn-subtle-tab ${activeVariablesTab === 'secrets' ? 'active' : ''}`}
                    onClick={() => setActiveVariablesTab('secrets')}
                    style={{ fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Lock size={13} />
                    Secrets ({Object.keys(testSecrets).length})
                  </button>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Interpolação ativa: <code style={{ color: '#93c5fd' }}>{'{{nome}}'}</code>
                </div>
              </div>

              {/* Tab 1: Parameters / Variables */}
              {activeVariablesTab === 'params' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Edite os valores abaixo para testar diferentes entradas nas ações:
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => {
                        const name = prompt('Nome da variável (ex: usuario, url_base, termo_busca):');
                        if (name && name.trim()) {
                          setTestParams(prev => ({ ...prev, [name.trim()]: '' }));
                        }
                      }}
                    >
                      <Plus size={11} /> Nova Variável
                    </button>
                  </div>

                  {Object.keys(testParams).length === 0 ? (
                    <div style={{ fontStyle: 'italic', fontSize: '11px', color: 'var(--text-dark)', padding: '6px 0' }}>
                      Nenhuma variável cadastrada. Clique em "+ Nova Variável" para adicionar.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                      {Object.entries(testParams).map(([k, val]) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#93c5fd', flexShrink: 0 }}>
                            {k}:
                          </span>
                          <input
                            type="text"
                            value={val}
                            onChange={e => {
                              const nextVal = e.target.value;
                              setTestParams(prev => ({ ...prev, [k]: nextVal }));
                            }}
                            placeholder="Valor de teste..."
                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', width: '100%', outline: 'none' }}
                          />
                          <button
                            type="button"
                            className="btn-icon-subtle btn-danger-hover"
                            style={{ padding: '2px', flexShrink: 0 }}
                            onClick={() => {
                              setTestParams(prev => {
                                const copy = { ...prev };
                                delete copy[k];
                                return copy;
                              });
                            }}
                            title={`Remover variável ${k}`}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Secrets */}
              {activeVariablesTab === 'secrets' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Valores vazios usam automaticamente o cofre criptografado do banco de dados:
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => {
                        const name = prompt('Nome do Secret (ex: senha_banco, token_api):');
                        if (name && name.trim()) {
                          setTestSecrets(prev => ({ ...prev, [name.trim()]: '' }));
                        }
                      }}
                    >
                      <Plus size={11} /> Novo Secret
                    </button>
                  </div>

                  {Object.keys(testSecrets).length === 0 ? (
                    <div style={{ fontStyle: 'italic', fontSize: '11px', color: 'var(--text-dark)', padding: '6px 0' }}>
                      Nenhum secret cadastrado nas ações. Clique em "+ Novo Secret" para adicionar uma chave confidencial.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                      {Object.entries(testSecrets).map(([k, val]) => {
                        const isRevealed = !!revealedSecrets[k];
                        const isUsingVault = !val;

                        return (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#facc15', flexShrink: 0 }}>
                              {k}:
                            </span>
                            <input
                              type={isRevealed ? 'text' : 'password'}
                              value={val}
                              onChange={e => {
                                const nextVal = e.target.value;
                                setTestSecrets(prev => ({ ...prev, [k]: nextVal }));
                              }}
                              placeholder={isUsingVault ? '(Cofre do Banco)' : 'Senha de teste...'}
                              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', width: '100%', outline: 'none' }}
                            />
                            <button
                              type="button"
                              className="btn-icon-subtle"
                              style={{ padding: '2px', flexShrink: 0 }}
                              onClick={() => toggleRevealSecret(k)}
                              title={isRevealed ? 'Ocultar' : 'Visualizar'}
                            >
                              {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                            <button
                              type="button"
                              className="btn-icon-subtle btn-danger-hover"
                              style={{ padding: '2px', flexShrink: 0 }}
                              onClick={() => {
                                setTestSecrets(prev => {
                                  const copy = { ...prev };
                                  delete copy[k];
                                  return copy;
                                });
                              }}
                              title={`Remover secret ${k}`}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Palette Bar */}
          <div className="sandbox-palette-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexGrow: 1 }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {steps.length} {steps.length === 1 ? 'ação' : 'ações'}
              </span>
              {steps.length > 0 && (
                <>
                  <button
                    type="button"
                    className="palette-btn"
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                    onClick={expandAllSteps}
                    title="Expandir todas as ações"
                  >
                    Expandir
                  </button>
                  <button
                    type="button"
                    className="palette-btn"
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                    onClick={collapseAllSteps}
                    title="Recolher todas as ações"
                  >
                    Recolher
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Steps List */}
          <div className="sandbox-steps-list">
            {steps.length === 0 ? (
              <div className="sandbox-empty-steps">
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  <FlaskConical size={24} color="#60a5fa" />
                </div>
                <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-light)' }}>Nenhuma ação configurada no Studio</h4>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', maxWidth: '360px' }}>
                  Adicione ações usando a paleta acima, ou clique em <strong>"Importar..."</strong> para testar um bloco ou pipeline completo.
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowImportModal(true)}>
                    <FolderInput size={13} /> Importar Pipeline / Bloco
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => addStep('navigate')}>
                    <Plus size={13} /> Adicionar Primeira Ação
                  </button>
                </div>
              </div>
            ) : (
              steps.map((step, index) => {
                const isExecuting = executingStepIndex === index;
                const result = stepResults[index];
                const isCollapsed = !!collapsedSteps[index];

                return (
                  <div
                    key={index}
                    ref={el => { stepRefs.current[index] = el; }}
                    className={`sandbox-step-card ${isExecuting ? 'step-executing' : ''} ${result ? (result.success ? 'step-success' : 'step-failed') : ''}`}
                  >
                    {/* Step Card Header */}
                    <div className="step-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-icon-subtle"
                          style={{ padding: '2px' }}
                          onClick={() => toggleStepCollapse(index)}
                          title={isCollapsed ? "Expandir detalhes da ação" : "Recolher detalhes da ação"}
                        >
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>

                        <span className="step-card-index">{index + 1}</span>

                        {/* Source Block Badge */}
                        {step.sourceBlockName && (
                          <span
                            className="badge"
                            style={{
                              fontSize: '10px',
                              padding: '2px 7px',
                              background: 'rgba(168, 85, 247, 0.15)',
                              color: '#d8b4fe',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title={`Etapa originária do bloco "${step.sourceBlockName}"`}
                          >
                            <Boxes size={10} /> {step.sourceBlockName}
                          </span>
                        )}

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

                        <button
                          type="button"
                          className="btn-icon-subtle"
                          disabled={index === 0}
                          onClick={() => moveStep(index, -1)}
                          title="Mover para cima"
                        >
                          <ArrowUp size={13} />
                        </button>

                        <button
                          type="button"
                          className="btn-icon-subtle"
                          disabled={index === steps.length - 1}
                          onClick={() => moveStep(index, 1)}
                          title="Mover para baixo"
                        >
                          <ArrowDown size={13} />
                        </button>

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

                    {/* Collapsed Step Preview */}
                    {isCollapsed ? (
                      <div
                        style={{
                          padding: '7px 12px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(0,0,0,0.1)'
                        }}
                        onClick={() => toggleStepCollapse(index)}
                      >
                        <span style={{ color: 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>
                          {getStepSummary(step)}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--color-primary)' }}>
                          Clique para editar
                        </span>
                      </div>
                    ) : (
                      /* Expanded Step Body */
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
                          <div className="sandbox-step-grid-3">
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
                          <div className="sandbox-step-grid-3">
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
                          <div className="sandbox-step-grid-3">
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
                              <label style={{ fontSize: '11px' }}>Valor da Opção (value)</label>
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
                          <div className="sandbox-step-grid-3">
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
                                <option value="networkidle">Rede Ociosa (Network Idle)</option>
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
                          <div className="sandbox-step-grid-2">
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

                        {/* Dynamic Script */}
                        {step.type === 'dynamic_script' && (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <label style={{ fontSize: '11px', margin: 0 }}>Script Dinâmico (Browser Context)</label>
                            </div>
                            <CodeEditor
                              value={step.script || ''}
                              onChange={code => updateStep(index, 'script', code)}
                              language="javascript"
                              rows={4}
                              placeholder="// Código JS a ser executado no navegador"
                            />
                          </div>
                        )}

                        {/* List Elements / Extract Text */}
                        {step.type === 'list_elements' && (
                          <div className="sandbox-step-grid-2">
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

                        {/* Conditional If */}
                        {step.type === 'conditional_if' && (
                          <div className="sandbox-step-grid-2">
                            <div>
                              <label style={{ fontSize: '11px' }}>Verificar se Elemento Existe</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: '12px', padding: '6px 10px' }}
                                placeholder="#popup-fechar ou .alerta"
                                value={step.selector_exists || step.selector || ''}
                                onChange={e => {
                                  updateStep(index, 'selector_exists', e.target.value);
                                  updateStep(index, 'selector', e.target.value);
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px' }}>Tipo Seletor</label>
                              <select
                                className="form-control"
                                style={{ fontSize: '12px', padding: '6px 10px' }}
                                value={step.selector_type || 'css'}
                                onChange={e => updateStep(index, 'selector_type', e.target.value)}
                              >
                                <option value="css">CSS Seletor</option>
                                <option value="id">ID (#)</option>
                                <option value="xpath">XPath</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Extract HTML */}
                        {step.type === 'extract_html' && (
                          <div className="sandbox-step-grid-2">
                            <div>
                              <label style={{ fontSize: '11px' }}>Seletor do Elemento (Opcional)</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: '12px', padding: '6px 10px' }}
                                placeholder="Deixe em branco para extrair a página inteira"
                                value={step.selector || ''}
                                onChange={e => updateStep(index, 'selector', e.target.value)}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px' }}>Tipo Seletor</label>
                              <select
                                className="form-control"
                                style={{ fontSize: '12px', padding: '6px 10px' }}
                                value={step.selector_type || 'css'}
                                onChange={e => updateStep(index, 'selector_type', e.target.value)}
                              >
                                <option value="css">CSS Seletor</option>
                                <option value="id">ID (#)</option>
                                <option value="xpath">XPath</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* User Prompt */}
                        {step.type === 'user_prompt' && (
                          <div>
                            <label style={{ fontSize: '11px' }}>Mensagem do Prompt Interativo</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                              placeholder="ex: Por favor, informe os dados necessários"
                              value={step.message || ''}
                              onChange={e => updateStep(index, 'message', e.target.value)}
                            />
                            {Array.isArray(step.vars) && step.vars.length > 0 && (
                              <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                Variáveis solicitadas: {step.vars.map(v => v.name).join(', ')}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Agent Control */}
                        {step.type === 'agent_control' && (
                          <div>
                            <label style={{ fontSize: '11px' }}>Instrução para Agente de IA</label>
                            <textarea
                              className="form-control"
                              style={{ fontSize: '12px', padding: '6px 10px', resize: 'vertical' }}
                              rows={2}
                              placeholder="Descreva a tarefa que a IA deve realizar nesta página"
                              value={step.instruction || step.prompt || ''}
                              onChange={e => updateStep(index, 'instruction', e.target.value)}
                            />
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

                        {/* Fallback for any other custom step */}
                        {!['navigate', 'click', 'type', 'select', 'wait', 'keypress', 'eval', 'dynamic_script', 'list_elements', 'screenshot', 'conditional_if', 'extract_html', 'user_prompt', 'agent_control'].includes(step.type) && (
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Configuração da Ação ({step.type})</label>
                            <pre style={{ margin: 0, padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                              {JSON.stringify(step, null, 2)}
                            </pre>
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
                    )}
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

      {/* Quick Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)} style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderInput size={18} color="var(--color-primary)" /> Importar para o Live Sandbox
              </h3>
              <p className="text-muted" style={{ fontSize: '12px', margin: '4px 0 0' }}>
                Selecione uma Pipeline para importar todas as suas ações em sequência, ou escolha um Bloco individual.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className={`btn-subtle-tab ${importModalTab === 'pipelines' ? 'active' : ''}`}
                  onClick={() => setImportModalTab('pipelines')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Workflow size={14} /> Pipelines ({tasks.length})
                </button>
                <button
                  type="button"
                  className={`btn-subtle-tab ${importModalTab === 'blocks' ? 'active' : ''}`}
                  onClick={() => setImportModalTab('blocks')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Boxes size={14} /> Blocos ({blocks.length})
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {importModalTab === 'pipelines' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Nenhuma pipeline cadastrada no sistema.
                    </div>
                  ) : (
                    tasks.map(task => (
                      <div
                        key={task.id}
                        className="list-item"
                        style={{ padding: '10px 14px', cursor: 'pointer' }}
                        onClick={() => {
                          requestImport({ type: 'pipeline', data: task });
                        }}
                      >
                        <div style={{ flexGrow: 1 }}>
                          <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Workflow size={13} color="#c084fc" /> {task.name}
                          </h4>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {task.description || `${task.blocks?.length || 0} blocos encadeados`}
                          </span>
                        </div>
                        <span className="badge badge-info" style={{ fontSize: '11px' }}>
                          {task.blocks?.length || 0} blocos
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {importModalTab === 'blocks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {blocks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Nenhum bloco cadastrado no sistema.
                    </div>
                  ) : (
                    blocks.map(blk => (
                      <div
                        key={blk.id}
                        className="list-item"
                        style={{ padding: '10px 14px', cursor: 'pointer' }}
                        onClick={() => {
                          requestImport({ type: 'block', data: blk });
                        }}
                      >
                        <div style={{ flexGrow: 1 }}>
                          <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Boxes size={13} color="#60a5fa" /> {blk.name}
                          </h4>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {blk.description || `${blk.steps?.length || 0} etapas`}
                          </span>
                        </div>
                        <span className="badge badge-info" style={{ fontSize: '11px' }}>
                          {blk.steps?.length || 0} etapas
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowImportModal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 2: Conflict / Import Mode Selection Modal */}
      {pendingImport && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '92%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="sandbox-badge-logo" style={{ background: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                  <FolderInput size={18} color="#c084fc" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-light)' }}>Como deseja importar as ações?</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Importando <strong>{pendingImport.name}</strong> ({pendingImport.steps.length} {pendingImport.steps.length === 1 ? 'ação' : 'ações'})
                  </span>
                </div>
              </div>
              <button type="button" className="btn-icon-subtle" onClick={() => setPendingImport(null)} title="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>
                O Studio já contém <strong>{steps.length}</strong> {steps.length === 1 ? 'ação configurada' : 'ações configuradas'}. Escolha o que deseja fazer com as <strong>{pendingImport.steps.length}</strong> novas ações:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                {/* Option 1: Substituir */}
                <button
                  type="button"
                  className="import-mode-card"
                  onClick={() => applyImport(pendingImport, 'replace')}
                >
                  <div className="import-mode-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
                    <RotateCcw size={18} />
                  </div>
                  <div style={{ flexGrow: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-light)' }}>Substituir Todas as Ações</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Limpa a sequência atual e carrega apenas as {pendingImport.steps.length} ações importadas.</div>
                  </div>
                </button>

                {/* Option 2: Adicionar no Início */}
                <button
                  type="button"
                  className="import-mode-card"
                  onClick={() => applyImport(pendingImport, 'prepend')}
                >
                  <div className="import-mode-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }}>
                    <ArrowUp size={18} />
                  </div>
                  <div style={{ flexGrow: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-light)' }}>Adicionar no Início</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Insere as {pendingImport.steps.length} novas ações antes das ações existentes no Studio.</div>
                  </div>
                </button>

                {/* Option 3: Adicionar no Final */}
                <button
                  type="button"
                  className="import-mode-card"
                  onClick={() => applyImport(pendingImport, 'append')}
                >
                  <div className="import-mode-icon" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#4ade80' }}>
                    <ArrowDown size={18} />
                  </div>
                  <div style={{ flexGrow: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-light)' }}>Adicionar no Final</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Anexa as {pendingImport.steps.length} novas ações após as ações existentes no Studio.</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPendingImport(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
