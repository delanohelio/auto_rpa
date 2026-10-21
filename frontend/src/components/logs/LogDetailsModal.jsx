import React, { useState, useEffect, useRef } from 'react';
import {
  XCircle,
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Download,
  Code,
  Maximize2,
  Minimize2,
  Sparkles,
  Copy,
  Check,
  FileText,
  Eye,
  MousePointer,
  Lock,
  Columns,
  Globe,
  Square,
  Bot,
  Camera,
  Terminal
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import JsonViewer from '../code/JsonViewer';
import HtmlViewerModal from '../code/HtmlViewerModal';
import AgentSkillModal from '../common/AgentSkillModal';

export default function LogDetailsModal({ logId, onClose, onRefreshList }) {
  const { apiFetch } = useAuth();
  const toast = useToast();

  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [viewingHtml, setViewingHtml] = useState(null);
  const [copiedEvalIdx, setCopiedEvalIdx] = useState(null);

  // Live Stream & Mode State
  const [streamKey, setStreamKey] = useState(Date.now());

  // Interactive Prompt & Manual State
  const [promptFormValues, setPromptFormValues] = useState({});
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [copiedAgentPrompt, setCopiedAgentPrompt] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);

  // Translate click events accurately to 1280x720 accounting for object-fit: contain letterboxing
  const getRenderedImageCoordinates = (e, imgElement, naturalW = 1280, naturalH = 720) => {
    if (!imgElement) return null;
    const rect = imgElement.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;
    if (!containerW || !containerH) return null;

    const imageRatio = naturalW / naturalH;
    const containerRatio = containerW / containerH;

    let renderedW, renderedH, offsetX, offsetY;
    if (containerRatio > imageRatio) {
      renderedH = containerH;
      renderedW = containerH * imageRatio;
      offsetX = (containerW - renderedW) / 2;
      offsetY = 0;
    } else {
      renderedW = containerW;
      renderedH = containerW / imageRatio;
      offsetX = 0;
      offsetY = (containerH - renderedH) / 2;
    }

    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    if (clickX < 0 || clickX > renderedW || clickY < 0 || clickY > renderedH) {
      return null;
    }

    const normX = Math.round((clickX / renderedW) * naturalW);
    const normY = Math.round((clickY / renderedH) * naturalH);
    return {
      x: Math.max(0, Math.min(naturalW, normX)),
      y: Math.max(0, Math.min(naturalH, normY))
    };
  };

  const fetchLogDetails = async () => {
    if (!logId) return;
    try {
      const res = await apiFetch(`/api/logs/${logId}`);
      if (res.ok) {
        const data = await res.json();
        setLog(data);
      }
    } catch (err) {
      console.error('Failed to fetch log details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogDetails();
  }, [logId]);

  // Polling if log is running
  useEffect(() => {
    if (!log || log.status !== 'running') return;
    const interval = setInterval(() => {
      fetchLogDetails();
    }, 2000);
    return () => clearInterval(interval);
  }, [log?.status]);

  // Find active manual interaction step
  const manualStep = (log?.stepsExecuted || []).find(
    s => s.status === 'running' && s.data && s.data.isManualInteraction && !s.data.completed
  );

  // Find active agent handoff step
  const agentStep = (log?.stepsExecuted || []).find(
    s => s.status === 'running' && (s.type === 'agent_control' || s.data?.isAgentControl) && s.data?.agentStatus !== 'completed'
  );

  const handleCopyAgentPrompt = (runId) => {
    const origin = window.location.origin;
    const promptText = `Você é um agente de IA operando o AutoRPA no modo Handoff Agente.
Manual da Skill: ${origin}/skills/autorpa-agent-handoff/SKILL.md
URL Base da API: ${origin}
ID da Sessão (runId): ${runId}

A pipeline do AutoRPA pausou e está aguardando você assumir o controle do navegador!
Passos para executar:
1. Assumir o controle (Acquire):
curl -X POST "${origin}/api/agent/acquire" \\
  -H "Content-Type: application/json" \\
  -d '{"runId": "${runId}"}'

2. Executar ações no navegador (eval, click, fill, screenshot, html, navigate):
curl -X POST "${origin}/api/agent/execute" \\
  -H "Content-Type: application/json" \\
  -d '{"runId": "${runId}", "action": "eval", "params": {"script": "return document.title"}}'

3. Devolver o controle para o AutoRPA continuar o pipeline (Release):
curl -X POST "${origin}/api/agent/release" \\
  -H "Content-Type: application/json" \\
  -d '{"runId": "${runId}"}'`;

    navigator.clipboard.writeText(promptText);
    setCopiedAgentPrompt(true);
    toast.success('Prompt Copiado', 'Instruções e dados de acquire copiados para a área de transferência.');
    setTimeout(() => setCopiedAgentPrompt(false), 2500);
  };

  const handleCopyCurl = (runId) => {
    const origin = window.location.origin;
    const curlCmd = `curl -X POST "${origin}/api/agent/acquire" -H "Content-Type: application/json" -d '{"runId":"${runId}"}'`;
    navigator.clipboard.writeText(curlCmd);
    setCopiedCurl(true);
    toast.success('cURL Copiado', 'Comando curl de acquire copiado!');
    setTimeout(() => setCopiedCurl(false), 2500);
  };

  // Handle continuing manual interaction
  const handleContinueManualInteraction = async () => {
    setIsSubmittingPrompt(true);
    try {
      const res = await apiFetch('/api/interactive/continue', {
        method: 'POST',
        body: JSON.stringify({ runId: log.id })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao confirmar continuação');
      }
      toast.success('Interação Concluída', 'Retomando a execução da pipeline...');
      fetchLogDetails();
      onRefreshList?.();
    } catch (err) {
      toast.error('Erro ao continuar', err.message);
    } finally {
      setIsSubmittingPrompt(false);
    }
  };

  // Handle stopping the pipeline run
  const handleStopRun = async () => {
    if (!log?.id) return;
    if (!window.confirm('Tem certeza de que deseja parar a execução deste pipeline agora?')) return;
    setIsStopping(true);
    try {
      const res = await apiFetch(`/api/runs/${log.id}/stop`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao parar execução');
      }
      toast.success('Execução Cancelada', 'A execução do pipeline foi interrompida.');
      await fetchLogDetails();
      onRefreshList?.();
    } catch (err) {
      toast.error('Erro ao parar execução', err.message);
    } finally {
      setIsStopping(false);
    }
  };

  // Dispatch mouse click on live browser screen during manual interaction
  const handleBrowserClick = async (e) => {
    if (!manualStep) return;
    const coords = getRenderedImageCoordinates(e, e.currentTarget, 1280, 720);
    if (!coords) return;

    try {
      await apiFetch(`/api/runs/${log.id}/interact`, {
        method: 'POST',
        body: JSON.stringify({ type: 'click', x: coords.x, y: coords.y })
      });
    } catch (err) {
      console.warn('Interação de clique falhou:', err.message);
    }
  };

  const handleSubmitPrompt = async (e, promptVars) => {
    e.preventDefault();
    setIsSubmittingPrompt(true);
    try {
      const finalValues = {};
      promptVars.forEach(v => {
        finalValues[v.name] = promptFormValues[v.name] !== undefined
          ? promptFormValues[v.name]
          : (v.value !== undefined ? v.value : v.defaultValue);
      });

      const res = await apiFetch('/api/interactive/submit', {
        method: 'POST',
        body: JSON.stringify({ runId: log.id, values: finalValues })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao enviar variáveis');
      }

      toast.success('Variáveis Enviadas', 'A pipeline continuou a execução.');
      await fetchLogDetails();
      onRefreshList?.();
    } catch (err) {
      toast.error('Erro no Preenchimento', err.message);
    } finally {
      setIsSubmittingPrompt(false);
    }
  };

  const handleCopyEvalReturn = (output, idx) => {
    const textToCopy = typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output);
    navigator.clipboard.writeText(textToCopy);
    setCopiedEvalIdx(idx);
    toast.success('Copiado', 'Retorno do script copiado para a área de transferência.');
    setTimeout(() => {
      setCopiedEvalIdx(null);
    }, 2000);
  };

  if (!log && loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={{ textAlign: 'center', padding: '60px', maxWidth: '400px' }}>
          <RefreshCw className="spin" size={32} color="var(--color-primary)" style={{ margin: '0 auto 16px' }} />
          <p className="text-muted">Carregando relatório da execução...</p>
        </div>
      </div>
    );
  }

  if (!log) return null;

  // Requirement 1: Lock the view strictly to the chosen execution mode
  // 1.1: Headless (log.headless !== false) -> 1 column displaying only logs and screenshots
  // 1.2: Headed (log.headless === false) -> 2 columns displaying left logs and right real-time browser
  const isHeaded = log.headless === false;
  const showTwoColumns = isHeaded;
  const streamUrl = `/api/runs/${log.id}/stream?t=${streamKey}${localStorage.getItem('systemPassword') ? `&token=${encodeURIComponent(localStorage.getItem('systemPassword'))}` : ''}`;

  // Collect all screenshots captured during this execution
  const allScreenshots = [];
  if (log.stepsExecuted && Array.isArray(log.stepsExecuted)) {
    log.stepsExecuted.forEach((step, idx) => {
      if (step.screenshotPath) {
        allScreenshots.push({
          url: step.screenshotPath,
          title: `Etapa ${step.stepIndex !== undefined ? step.stepIndex + 1 : idx + 1}: ${step.blockName || step.type}`,
          subtitle: step.endedAt ? new Date(step.endedAt).toLocaleTimeString('pt-BR') : `Ação ${step.type}`,
          stepIndex: idx
        });
      }
    });
  }
  if (log.screenshotPath && !allScreenshots.some(s => s.url === log.screenshotPath)) {
    allScreenshots.push({
      url: log.screenshotPath,
      title: log.status === 'failure' ? 'Captura no Erro de Execução' : 'Captura Final do Navegador',
      subtitle: log.endedAt ? new Date(log.endedAt).toLocaleTimeString('pt-BR') : '',
      stepIndex: -1
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className={`modal-content ${showTwoColumns ? 'modal-fullscreen-2col' : ''}`}
        style={!showTwoColumns ? { maxWidth: '920px' } : undefined}
        onClick={e => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '36px' }}>
            <div>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Detalhes da Execução: {log.taskName}</span>
                {log.status === 'running' && (
                  <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span className="active-pulse-dot" /> Ao Vivo
                  </span>
                )}
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                Run ID: {log.id} &bull; Disparado em {new Date(log.startedAt).toLocaleString('pt-BR')}
              </div>
            </div>

            {/* Controls in Header: Stop Run & Mode Lock Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {log?.status === 'running' && (
                <button
                  type="button"
                  className="btn-stop-run"
                  disabled={isStopping}
                  onClick={handleStopRun}
                  title="Interromper imediatamente a execução do pipeline"
                >
                  {isStopping ? <RefreshCw className="spin" size={13} /> : <Square size={13} style={{ fill: 'currentColor' }} />}
                  <span>Parar Execução</span>
                </button>
              )}

              {isHeaded ? (
                <span
                  className="badge-headed-locked"
                  title="Execução em modo Headed: visualização travada em 2 colunas com o navegador"
                >
                  <Columns size={13} />
                  <span>Modo Headed (2 Colunas)</span>
                </span>
              ) : (
                <span
                  className="badge-headless-locked"
                  title="Execução em modo Headless: visualização travada exibindo logs e screenshots"
                >
                  <FileText size={13} />
                  <span>Modo Headless (Logs e Screenshots)</span>
                </span>
              )}
            </div>
          </div>

          <XCircle className="modal-close" size={24} onClick={onClose} />
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {showTwoColumns ? (
            /* ========================================================== */
            /* 2-COLUMN FULLSCREEN VIEWPORT LAYOUT                        */
            /* ========================================================== */
            <div className="modal-2col-layout">
              {/* LEFT COLUMN: Actions & Execution Details */}
              <div className="modal-col-left">
                {/* Stats Grid */}
                <div className="stats-grid" style={{ marginBottom: '4px', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div className="card" style={{ padding: '12px' }}>
                    <p className="stat-title" style={{ fontSize: '11px', marginBottom: '6px' }}>Status</p>
                    <span
                      className={`badge ${
                        log.status === 'success' ? 'badge-success' :
                        log.status === 'failure' ? 'badge-danger' :
                        log.status === 'cancelled' ? 'badge-danger' : 'badge-warning'
                      }`}
                      style={{ fontSize: '12px' }}
                    >
                      {log.status === 'success' ? 'Sucesso' :
                       log.status === 'failure' ? 'Falha' :
                       log.status === 'cancelled' ? 'Cancelado' : 'Executando'}
                    </span>
                  </div>

                  <div className="card" style={{ padding: '12px' }}>
                    <p className="stat-title" style={{ fontSize: '11px', marginBottom: '6px' }}>Origem</p>
                    <div>
                      {log.trigger === 'schedule' ? (
                        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 6px' }}>
                          <Clock size={11} /> Agendado
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 6px' }}>
                          <Play size={11} /> Manual
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="card" style={{ padding: '12px' }}>
                    <p className="stat-title" style={{ fontSize: '11px', marginBottom: '6px' }}>Duração</p>
                    <p style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                      {log.status === 'running' ? 'Em andamento...' : `${log.duration}s`}
                    </p>
                  </div>

                  <div className="card" style={{ padding: '12px' }}>
                    <p className="stat-title" style={{ fontSize: '11px', marginBottom: '6px' }}>Navegação</p>
                    <span
                      className="badge"
                      style={{
                        fontSize: '11px',
                        background: log.headless === false ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: log.headless === false ? '#d8b4fe' : '#60a5fa',
                        border: log.headless === false ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      {log.headless === false ? 'Headed' : 'Headless'}
                    </span>
                  </div>
                </div>

                {/* Error Alert */}
                {log.error && (
                  <div className="badge badge-danger mb-16" style={{ width: '100%', borderRadius: '8px', padding: '12px 16px', textTransform: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                      <AlertCircle size={15} /> Erro de Execução
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{log.error}</div>
                  </div>
                )}

                {/* Manual Interaction Card in Left Column */}
                {manualStep && (
                  <div
                    className="card mb-16"
                    style={{
                      border: '2px solid #a855f7',
                      background: 'rgba(168, 85, 247, 0.1)',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', color: '#d8b4fe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MousePointer size={16} /> Interação Manual Solicitada
                      </h4>
                      <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.25)', color: '#e9d5ff', border: '1px solid #a855f7', fontSize: '10px' }}>
                        Aguardando Você
                      </span>
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '12px', lineHeight: 1.4 }}>
                      {manualStep.data.instruction || 'Por favor, realize as ações necessárias com o mouse e teclado na tela do navegador.'}
                    </p>

                    <button
                      type="button"
                      className="btn-continue-interaction"
                      disabled={isSubmittingPrompt}
                      onClick={handleContinueManualInteraction}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      {isSubmittingPrompt ? <RefreshCw className="spin" size={14} /> : <Play size={14} style={{ fill: 'currentColor' }} />}
                      Concluir Interação & Continuar
                    </button>
                  </div>
                )}

                {/* Agent Handoff Card in Left Column */}
                {agentStep && (
                  <div
                    className="card mb-16"
                    style={{
                      border: '2px solid #a855f7',
                      background: 'rgba(168, 85, 247, 0.08)',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', color: '#d8b4fe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Bot size={16} /> Handoff Agente IA Ativo
                      </h4>
                      <span
                        className="badge"
                        style={{
                          background: agentStep.data?.agentStatus === 'acquired' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(168, 85, 247, 0.25)',
                          color: agentStep.data?.agentStatus === 'acquired' ? '#93c5fa' : '#e9d5ff',
                          border: '1px solid #a855f7',
                          fontSize: '10px'
                        }}
                      >
                        {agentStep.data?.agentStatus === 'acquired' ? 'Sessão Assumida pela IA' : 'Aguardando Acquire'}
                      </span>
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '8px', lineHeight: 1.4 }}>
                      {agentStep.data?.agentStatus === 'acquired'
                        ? 'O agente de IA está conectado e operando o navegador.'
                        : 'A automação pausou aguardando o agente assumir a sessão.'}
                    </p>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>Sessão: <code style={{ color: '#c084fc', fontWeight: 600 }}>{log.id}</code></span>
                      <span>Acquire: <strong>{agentStep.data?.acquireTimeout || 60}s</strong></span>
                      <span>Execução: <strong>{agentStep.data?.executionTimeout || 120}s</strong></span>
                    </div>

                    <div
                      style={{
                        background: '#090d16',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        marginBottom: '10px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', color: '#c084fc', fontWeight: 600 }}>
                        <span>Prompt para Agente / IA:</span>
                        <button
                          type="button"
                          onClick={() => handleCopyAgentPrompt(log.id)}
                          style={{ background: 'transparent', border: 'none', color: copiedAgentPrompt ? '#4ade80' : '#93c5fd', cursor: 'pointer', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          {copiedAgentPrompt ? <Check size={12} /> : <Copy size={12} />}
                          {copiedAgentPrompt ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.4, wordBreak: 'break-all' }}>
                        <div>POST /api/agent/acquire &#123; "runId": "{log.id}" &#125;</div>
                        <div style={{ color: '#93c5fd', marginTop: '2px' }}>{window.location.origin}/skills/autorpa-agent-handoff/SKILL.md</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleCopyAgentPrompt(log.id)}
                        style={{ flex: 1, minWidth: '120px', justifyContent: 'center', background: '#9333ea', borderColor: '#a855f7', fontSize: '11px' }}
                      >
                        {copiedAgentPrompt ? <Check size={12} /> : <Copy size={12} />}
                        Copiar Prompt
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopyCurl(log.id)}
                        style={{ justifyContent: 'center', fontSize: '11px' }}
                        title="Copiar comando cURL para executar no terminal"
                      >
                        {copiedCurl ? <Check size={12} /> : <Terminal size={12} />}
                        cURL
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowSkillModal(true)}
                        style={{ justifyContent: 'center', color: '#d8b4fe', borderColor: 'rgba(168, 85, 247, 0.4)', fontSize: '11px' }}
                      >
                        <FileText size={12} /> Skill
                      </button>
                    </div>
                  </div>
                )}

                {/* Interactive Prompt Card (user_prompt) */}
                {log.status === 'running' && (() => {
                  const promptStep = (log.stepsExecuted || []).find(
                    s => s.status === 'running' && s.data && s.data.isUserPrompt && !s.data.completed
                  );
                  if (!promptStep) return null;

                  const promptVars = promptStep.data.vars || [];
                  const dynamicData = promptStep.data.dynamicData;

                  return (
                    <div className="card mb-16" style={{ border: '2px solid var(--color-primary)', background: 'rgba(59, 130, 246, 0.08)', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <HelpCircle size={16} /> {promptStep.data.promptTitle || 'Preenchimento Interativo'}
                        </h4>
                        <span className="badge badge-warning" style={{ fontSize: '10px' }}>Aguardando</span>
                      </div>

                      {promptStep.data.promptDescription && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          {promptStep.data.promptDescription}
                        </p>
                      )}

                      <form onSubmit={e => handleSubmitPrompt(e, promptVars)}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                          {promptVars.map((v, vIdx) => {
                            const optionKey = `options_for_${v.name}`;
                            const options = dynamicData?.[optionKey];
                            const currentValue = promptFormValues[v.name] !== undefined ? promptFormValues[v.name] : (v.value !== undefined ? v.value : v.defaultValue);

                            return (
                              <div key={vIdx} className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '12px', marginBottom: '4px' }}>{v.label || v.name}:</label>
                                {Array.isArray(options) && options.length > 0 ? (
                                  <select
                                    className="form-control"
                                    value={currentValue}
                                    onChange={e => setPromptFormValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                                    required
                                    style={{ fontSize: '12px' }}
                                  >
                                    <option value="">-- Selecione uma opção --</option>
                                    {options.map((opt, oIdx) => {
                                      const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.text) : opt;
                                      const optText = typeof opt === 'object' ? (opt.text !== undefined ? opt.text : opt.value) : opt;
                                      return <option key={oIdx} value={optVal}>{optText}</option>;
                                    })}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    className="form-control"
                                    placeholder={`Valor padrão: "${v.defaultValue}"`}
                                    value={currentValue || ''}
                                    onChange={e => setPromptFormValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                                    required
                                    style={{ fontSize: '12px' }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={isSubmittingPrompt}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          {isSubmittingPrompt ? <RefreshCw className="spin" size={13} /> : <CheckCircle2 size={13} />}
                          Confirmar e Continuar
                        </button>
                      </form>
                    </div>
                  );
                })()}

                {/* Steps Timeline Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '4px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                    Etapas do Pipeline ({log.stepsExecuted?.length || 0})
                  </h4>
                </div>

                {/* Steps Timeline Items */}
                <div className="log-step-timeline">
                  {(!log.stepsExecuted || log.stepsExecuted.length === 0) ? (
                    <p className="text-muted" style={{ fontSize: '12px' }}>Iniciando execução das etapas...</p>
                  ) : (
                    log.stepsExecuted.map((step, idx) => (
                      <div key={idx} className="log-step-item">
                        <span className={`log-step-indicator ${step.status}`} />

                        <div className="log-step-header">
                          <h4 style={{ fontSize: '13px' }}>
                            {step.blockName} &bull; Step {step.stepIndex + 1} &bull; 
                            <span style={{ textTransform: 'capitalize', color: 'var(--color-secondary)', marginLeft: '6px' }}>{step.type}</span>
                          </h4>
                          <span style={{ fontSize: '11px' }}>
                            {step.status === 'running'
                              ? (step.type === 'manual_interaction' ? 'Aguardando Usuário...' : 'Rodando...')
                              : step.status === 'skipped' ? 'Ignorado'
                              : 'Concluído'}
                          </span>
                        </div>

                        <div className="log-step-details" style={{ fontSize: '12px' }}>
                          <div><strong>Parâmetros:</strong> {JSON.stringify(step.params)}</div>

                          {step.data?.message && (
                            <div style={{ marginTop: '6px', color: 'var(--color-secondary)' }}>
                              <strong>Info:</strong> {step.data.message}
                            </div>
                          )}

                          {/* Eval return viewer */}
                          {step.type === 'eval' && step.data && (
                            <div
                              style={{
                                marginTop: '8px',
                                background: 'rgba(59, 130, 246, 0.07)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                borderRadius: 'var(--radius-md)',
                                padding: '10px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <strong style={{ color: 'var(--color-secondary)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Sparkles size={13} color="var(--color-primary)" /> Retorno do Script:
                                </strong>
                                {step.data.result !== undefined && step.data.result !== null && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '2px 6px', fontSize: '10px' }}
                                    onClick={() => handleCopyEvalReturn(step.data.result, idx)}
                                  >
                                    {copiedEvalIdx === idx ? 'Copiado!' : 'Copiar'}
                                  </button>
                                )}
                              </div>

                              {typeof step.data.result === 'object' && step.data.result !== null ? (
                                <JsonViewer data={step.data.result} title="Retorno" maxHeight="160px" />
                              ) : (
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: '8px',
                                    background: 'rgba(0, 0, 0, 0.4)',
                                    borderRadius: '4px',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '12px',
                                    whiteSpace: 'pre-wrap'
                                  }}
                                >
                                  {String(step.data.result)}
                                </pre>
                              )}
                            </div>
                          )}

                          {/* Dedicated HTTP Request Result Card */}
                          {step.type === 'http_request' && step.data && (
                            <div
                              style={{
                                marginTop: '8px',
                                background: 'rgba(6, 182, 212, 0.06)',
                                border: `1px solid ${step.data.ok ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                borderRadius: 'var(--radius-md)',
                                padding: '10px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Globe size={13} color="#22d3ee" />
                                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#22d3ee' }}>
                                    {step.data.method || 'GET'}
                                  </span>
                                  <span
                                    className="badge"
                                    style={{
                                      fontSize: '10px',
                                      background: step.data.ok ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                      color: step.data.ok ? '#34d399' : '#f87171',
                                      border: `1px solid ${step.data.ok ? '#10b981' : '#ef4444'}`
                                    }}
                                  >
                                    {step.data.status} {step.data.statusText || ''}
                                  </span>
                                  {step.data.durationMs !== undefined && (
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                      ({step.data.durationMs}ms)
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {step.data.savedToVars && (
                                    <span style={{ fontSize: '10px', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                      Salvo em: <strong>vars.{step.data.savedToVars}</strong>
                                    </span>
                                  )}
                                  {step.downloadPath && (
                                    <a
                                      href={step.downloadPath}
                                      download
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '2px 6px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={11} /> Baixar
                                    </a>
                                  )}
                                </div>
                              </div>

                              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '8px', wordBreak: 'break-all' }}>
                                {step.data.url}
                              </div>

                              {typeof step.data.data === 'object' && step.data.data !== null ? (
                                <JsonViewer data={step.data.data} title="Resposta JSON" maxHeight="160px" />
                              ) : (
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: '8px',
                                    background: 'rgba(0, 0, 0, 0.4)',
                                    borderRadius: '4px',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: '160px',
                                    overflowY: 'auto'
                                  }}
                                >
                                  {step.data.raw || String(step.data.data || '')}
                                </pre>
                              )}
                            </div>
                          )}

                          {/* Dedicated HTTP Request Result Card */}
                          {step.type === 'http_request' && step.data && (
                            <div
                              style={{
                                marginTop: '12px',
                                background: 'rgba(6, 182, 212, 0.06)',
                                border: `1px solid ${step.data.ok ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                borderRadius: 'var(--radius-md)',
                                padding: '12px 14px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Globe size={15} color="#22d3ee" />
                                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#22d3ee' }}>
                                    {step.data.method || 'GET'}
                                  </span>
                                  <span
                                    className="badge"
                                    style={{
                                      fontSize: '11px',
                                      background: step.data.ok ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                      color: step.data.ok ? '#34d399' : '#f87171',
                                      border: `1px solid ${step.data.ok ? '#10b981' : '#ef4444'}`
                                    }}
                                  >
                                    {step.data.status} {step.data.statusText || ''}
                                  </span>
                                  {step.data.durationMs !== undefined && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      ({step.data.durationMs}ms)
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {step.data.savedToVars && (
                                    <span style={{ fontSize: '11px', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '3px 8px', borderRadius: '4px' }}>
                                      Salvo em: <strong>vars.{step.data.savedToVars}</strong>
                                    </span>
                                  )}
                                  {step.downloadPath && (
                                    <a
                                      href={step.downloadPath}
                                      download
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                    >
                                      <Download size={12} /> Baixar Arquivo
                                    </a>
                                  )}
                                </div>
                              </div>

                              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '10px', wordBreak: 'break-all' }}>
                                {step.data.url}
                              </div>

                              {typeof step.data.data === 'object' && step.data.data !== null ? (
                                <JsonViewer data={step.data.data} title="Resposta Estruturada (JSON)" maxHeight="220px" />
                              ) : (
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: '10px 12px',
                                    background: 'rgba(0, 0, 0, 0.4)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '12px',
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: '220px',
                                    overflowY: 'auto'
                                  }}
                                >
                                  {step.data.raw || String(step.data.data || '')}
                                </pre>
                              )}
                            </div>
                          )}

                          {/* User JS Logs Viewer */}
                          {((step.userLogs?.length > 0) || (step.data?.userLogs?.length > 0)) && (
                            <div
                              style={{
                                marginTop: '8px',
                                background: 'rgba(0, 0, 0, 0.45)',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '8px 10px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', fontSize: '11px', color: '#c084fc', fontWeight: 600 }}>
                                <Terminal size={12} /> Logs da Função ({((step.userLogs || step.data?.userLogs) || []).length}):
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                {((step.userLogs || step.data?.userLogs) || []).map((msg, mIdx) => (
                                  <div key={mIdx} style={{ color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.04)', padding: '3px 6px', borderRadius: '3px', wordBreak: 'break-word' }}>
                                    <span style={{ color: '#c084fc', marginRight: '6px', fontWeight: 'bold' }}>&gt;</span>
                                    {msg}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Step screenshot preview */}
                          {step.screenshotPath && (
                            <div
                              className="step-inline-screenshot"
                              onClick={() => setSelectedScreenshot(step.screenshotPath)}
                              title="Clique para ampliar captura da etapa"
                            >
                              <img src={step.screenshotPath} alt={`Print da etapa ${step.stepIndex + 1}`} />
                              <div className="step-inline-screenshot-overlay">
                                <Maximize2 size={13} />
                                <span>Ver Captura de Tela</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Real-Time Browser Stream */}
              <div className="modal-col-right">
                {/* Browser Header Bar */}
                <div className="execution-browser-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={log.status === 'running' ? 'active-pulse-dot' : ''} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Globe size={15} color="var(--color-primary)" />
                      {log.status === 'running' ? 'Navegador em Tempo Real' : 'Captura / Estado Final'}
                    </span>
                    <span
                      className="badge"
                      style={{
                        fontSize: '11px',
                        background: log.headless === false ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: log.headless === false ? '#d8b4fe' : '#60a5fa',
                        border: log.headless === false ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      {log.headless === false ? 'Modo Headed (Visual)' : 'Modo Headless (Screencast)'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {manualStep ? (
                      <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.25)', color: '#e9d5ff', border: '1px solid #a855f7', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MousePointer size={12} /> Interação Liberada
                      </span>
                    ) : agentStep ? (
                      <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.25)', color: '#e9d5ff', border: '1px solid #a855f7', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Bot size={12} /> Handoff IA {agentStep.data?.agentStatus === 'acquired' ? 'Operando' : 'Aguardando'}
                      </span>
                    ) : log.status === 'running' ? (
                      <span className="browser-robot-badge">
                        <span className="browser-robot-badge-pulse" />
                        <Bot size={13} /> Robô em Execução — Interação Desabilitada
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '11px' }}>
                        Concluído
                      </span>
                    )}

                    {log.status === 'running' && (
                      <button
                        type="button"
                        className="btn-icon-subtle"
                        onClick={() => setStreamKey(Date.now())}
                        title="Recarregar transmissão ao vivo"
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Interactive Banner when manual_interaction is active (Requirement 1.2) */}
                {manualStep && (
                  <div className="browser-interactive-banner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(168, 85, 247, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(168, 85, 247, 0.4)'
                      }}>
                        <MousePointer size={16} color="#d8b4fe" />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f3e8ff' }}>
                          Interação Manual Liberada
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {manualStep.data.instruction || 'Realize as ações com mouse/teclado na janela ou diretamente na tela abaixo.'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-continue-interaction"
                      disabled={isSubmittingPrompt}
                      onClick={handleContinueManualInteraction}
                    >
                      {isSubmittingPrompt ? <RefreshCw className="spin" size={14} /> : <Play size={14} style={{ fill: 'currentColor' }} />}
                      <span>Concluir Interação & Continuar</span>
                    </button>
                  </div>
                )}

                {/* Agent Handoff Banner in Headed mode */}
                {agentStep && (
                  <div
                    className="browser-interactive-banner"
                    style={{
                      background: 'linear-gradient(90deg, rgba(147, 51, 234, 0.2) 0%, rgba(59, 130, 246, 0.15) 100%)',
                      borderColor: '#a855f7'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'rgba(168, 85, 247, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(168, 85, 247, 0.4)'
                        }}
                      >
                        <Bot size={16} color="#d8b4fe" />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f3e8ff' }}>
                          Handoff Agente de IA Ativo
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {agentStep.data?.agentStatus === 'acquired'
                            ? 'Agente conectado via API e interagindo com o navegador.'
                            : `Aguardando conexão do agente (runId: ${log.id})...`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-continue-interaction"
                        onClick={() => handleCopyAgentPrompt(log.id)}
                        style={{ background: '#9333ea', borderColor: '#a855f7' }}
                      >
                        {copiedAgentPrompt ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedAgentPrompt ? 'Prompt Copiado!' : 'Copiar Prompt de Acquire'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Viewport & Screencast Player (Screen 100% clean and unobstructed) */}
                <div className="execution-browser-viewport">
                  {log.status === 'running' ? (
                    <img
                      key={streamKey}
                      src={streamUrl}
                      alt="Transmissão ao vivo do navegador"
                      className={`execution-stream-image ${manualStep ? 'interactive-enabled' : 'robot-running'}`}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      onClick={handleBrowserClick}
                      onError={() => {
                        setTimeout(() => {
                          setStreamKey(Date.now());
                        }, 1500);
                      }}
                    />
                  ) : (
                    /* Finished Run View: Show final screenshot if available */
                    log.screenshotPath ? (
                      <img
                        src={log.screenshotPath}
                        alt="Captura final do navegador"
                        className="execution-stream-image"
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedScreenshot(log.screenshotPath)}
                      />
                    ) : (
                      <div className="empty-state" style={{ padding: '40px 20px', color: 'var(--text-muted)' }}>
                        <Globe size={40} style={{ opacity: 0.25, marginBottom: '12px' }} />
                        <p style={{ margin: 0, fontSize: '13px' }}>Navegador finalizado sem captura de tela.</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* SINGLE COLUMN CLASSIC VIEW (NO BROWSER OR USER COLLAPSED)  */
            /* ========================================================== */
            <>
              {/* Stats Grid */}
              <div className="stats-grid" style={{ marginBottom: '8px' }}>
                <div className="card" style={{ padding: '14px' }}>
                  <p className="stat-title">Status Final</p>
                  <span
                    className={`badge ${log.status === 'success' ? 'badge-success' : log.status === 'failure' ? 'badge-danger' : 'badge-warning'}`}
                    style={{ fontSize: '13px', marginTop: '4px' }}
                  >
                    {log.status === 'success' ? 'Sucesso' : log.status === 'failure' ? 'Falha' : 'Executando'}
                  </span>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <p className="stat-title">Origem do Disparo</p>
                  <div style={{ marginTop: '6px' }}>
                    {log.trigger === 'schedule' ? (
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}>
                        <Clock size={12} /> Agendado (Cron)
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px' }}>
                        <Play size={12} /> Manual
                      </span>
                    )}
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <p className="stat-title">Duração Total</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>
                    {log.status === 'running' ? 'Em andamento...' : `${log.duration} segundos`}
                  </p>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <p className="stat-title">Modo</p>
                  <span
                    className="badge"
                    style={{
                      fontSize: '11px',
                      marginTop: '4px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    Headless (Segundo Plano)
                  </span>
                </div>
              </div>

              {/* Error Alert */}
              {log.error && (
                <div className="badge badge-danger mb-16" style={{ width: '100%', borderRadius: '8px', padding: '14px 18px', textTransform: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <AlertCircle size={16} /> Erro de Execução (Halter)
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{log.error}</div>
                </div>
              )}

              {/* Manual Interaction Card */}
              {manualStep && (
                <div
                  className="card mb-16"
                  style={{
                    border: '2px solid #a855f7',
                    background: 'rgba(168, 85, 247, 0.08)',
                    padding: '20px',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MousePointer size={18} /> Interação Manual Solicitada
                    </h4>
                    <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.4)', fontSize: '11px' }}>
                      Aguardando Ação no Navegador
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '14px', lineHeight: 1.5 }}>
                    {manualStep.data.instruction || 'Por favor, realize as ações necessárias com o mouse e teclado na janela aberta do navegador.'}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      type="button"
                      className="btn-continue-interaction"
                      disabled={isSubmittingPrompt}
                      onClick={handleContinueManualInteraction}
                    >
                      {isSubmittingPrompt ? <RefreshCw className="spin" size={14} /> : <Play size={14} style={{ fill: 'currentColor' }} />}
                      Concluir Interação & Continuar Pipeline
                    </button>
                  </div>
                </div>
              )}

              {/* Agent Handoff Card in Single Column view */}
              {agentStep && (
                <div
                  className="card mb-16"
                  style={{
                    border: '2px solid #a855f7',
                    background: 'rgba(168, 85, 247, 0.08)',
                    padding: '20px',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Bot size={18} /> Handoff para Agente de IA
                    </h4>
                    <span className="badge" style={{ background: agentStep.data?.agentStatus === 'acquired' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(168, 85, 247, 0.2)', color: agentStep.data?.agentStatus === 'acquired' ? '#93c5fa' : '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.4)', fontSize: '11px' }}>
                      {agentStep.data?.agentStatus === 'acquired' ? 'Agente em Execução' : 'Aguardando Chamada de Acquire'}
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '12px', lineHeight: 1.5 }}>
                    Esta automação atingiu uma etapa de <strong>Handoff Agente</strong>. O navegador está mantido aberto aguardando um agente de IA (como Claude, Antigravity ou script autônomo) conectar-se via API.
                  </p>

                  <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>ID da Sessão: <code style={{ color: '#c084fc', fontWeight: 600 }}>{log.id}</code></span>
                    <span>Tempo de Conexão: <strong>{agentStep.data?.acquireTimeout || 60}s</strong></span>
                    <span>Tempo de Execução: <strong>{agentStep.data?.executionTimeout || 120}s</strong></span>
                  </div>

                  {/* Prompt Code Preview */}
                  <div
                    style={{
                      background: '#090d16',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      border: '1px solid rgba(168, 85, 247, 0.35)',
                      marginBottom: '16px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      lineHeight: 1.5
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '6px' }}>
                      <span style={{ color: '#c084fc', fontWeight: 600 }}>Prompt de Acquire para a IA:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyAgentPrompt(log.id)}
                        style={{ background: 'transparent', border: 'none', color: copiedAgentPrompt ? '#4ade80' : '#93c5fd', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedAgentPrompt ? <Check size={13} /> : <Copy size={13} />}
                        {copiedAgentPrompt ? 'Copiado!' : 'Copiar Prompt'}
                      </button>
                    </div>
                    <div>Você é um agente de IA operando o AutoRPA no modo Handoff Agente.</div>
                    <div><strong>Manual da Skill:</strong> <span style={{ color: '#93c5fd' }}>{window.location.origin}/skills/autorpa-agent-handoff/SKILL.md</span></div>
                    <div><strong>ID da Sessão (runId):</strong> <span style={{ color: '#c084fc' }}>{log.id}</span></div>
                    <div style={{ color: '#a78bfa', marginTop: '6px' }}>
                      POST {window.location.origin}/api/agent/acquire &#123; "runId": "{log.id}" &#125;
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowSkillModal(true)}
                      style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <FileText size={14} /> Ver Guia da Skill
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleCopyCurl(log.id)}
                      style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {copiedCurl ? <Check size={14} /> : <Terminal size={14} />}
                      Copiar cURL
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleCopyAgentPrompt(log.id)}
                      style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#9333ea', borderColor: '#a855f7' }}
                    >
                      {copiedAgentPrompt ? <Check size={14} /> : <Copy size={14} />}
                      {copiedAgentPrompt ? 'Prompt Copiado!' : 'Copiar Prompt Completo'}
                    </button>
                  </div>
                </div>
              )}

              {/* Screenshots Gallery Section (Requirement 1.1: Headless displays logs and screenshots) */}
              {allScreenshots.length > 0 && (
                <div className="screenshot-gallery-section mb-16">
                  <h4 style={{ fontSize: '14px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)' }}>
                    <Camera size={16} color="var(--color-primary)" />
                    Capturas de Tela ({allScreenshots.length})
                  </h4>
                  <div className="screenshot-gallery-grid">
                    {allScreenshots.map((sc, i) => (
                      <div
                        key={i}
                        className="screenshot-gallery-card"
                        onClick={() => setSelectedScreenshot(sc.url)}
                        title="Clique para ampliar em tela cheia"
                      >
                        <div className="screenshot-card-img-wrap">
                          <img src={sc.url} alt={sc.title} className="screenshot-card-img" />
                          <div className="screenshot-card-hover-overlay">
                            <Maximize2 size={16} />
                            <span>Ampliar</span>
                          </div>
                        </div>
                        <div className="screenshot-card-meta">
                          <div className="screenshot-card-title">{sc.title}</div>
                          {sc.subtitle && <div className="screenshot-card-sub">{sc.subtitle}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps Timeline */}
              <h4 style={{ fontSize: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginTop: '8px', marginBottom: '14px' }}>
                Histórico das Etapas Executadas ({log.stepsExecuted?.length || 0})
              </h4>

              <div className="log-step-timeline">
                {(!log.stepsExecuted || log.stepsExecuted.length === 0) ? (
                  <p className="text-muted" style={{ fontSize: '13px' }}>Nenhuma etapa registrada ainda para este log.</p>
                ) : (
                  log.stepsExecuted.map((step, idx) => (
                    <div key={idx} className="log-step-item">
                      <span className={`log-step-indicator ${step.status}`} />

                      <div className="log-step-header">
                        <h4>
                          {step.blockName} &bull; Step {step.stepIndex + 1} &bull; 
                          <span style={{ textTransform: 'capitalize', color: 'var(--color-secondary)', marginLeft: '6px' }}>{step.type}</span>
                        </h4>
                        <span>
                          {step.status === 'running'
                            ? (step.type === 'manual_interaction' ? 'Aguardando Usuário...' : 'Rodando...')
                            : step.status === 'skipped' ? 'Ignorado'
                            : 'Concluído'}
                        </span>
                      </div>

                      <div className="log-step-details">
                        <div><strong>Parâmetros:</strong> {JSON.stringify(step.params)}</div>

                        {step.data?.message && (
                          <div style={{ marginTop: '8px', color: 'var(--color-secondary)' }}>
                            <strong>Info:</strong> {step.data.message}
                          </div>
                        )}

                        {/* DEDICATED EVAL RETURN DISPLAY */}
                        {step.type === 'eval' && step.data && (
                          <div
                            style={{
                              marginTop: '12px',
                              background: 'rgba(59, 130, 246, 0.07)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              borderRadius: 'var(--radius-md)',
                              padding: '12px 14px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <strong style={{ color: 'var(--color-secondary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Sparkles size={14} color="var(--color-primary)" /> Retorno do Script (JSEval):
                              </strong>
                              {step.data.result !== undefined && step.data.result !== null && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleCopyEvalReturn(step.data.result, idx)}
                                  title="Copiar retorno para a área de transferência"
                                >
                                  {copiedEvalIdx === idx ? <Check size={12} color="var(--color-primary)" /> : <Copy size={12} />}
                                  {copiedEvalIdx === idx ? 'Copiado!' : 'Copiar Retorno'}
                                </button>
                              )}
                            </div>

                            {typeof step.data.result === 'object' && step.data.result !== null ? (
                              <JsonViewer data={step.data.result} title="Retorno Estruturado" maxHeight="200px" />
                            ) : (
                              <pre
                                style={{
                                  margin: 0,
                                  padding: '10px 12px',
                                  background: 'rgba(0, 0, 0, 0.4)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '13px',
                                  color: step.data.result === undefined || step.data.result === null ? 'var(--text-muted)' : 'var(--text-main)',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all'
                                }}
                              >
                                {step.data.result === undefined ? 'undefined' : step.data.result === null ? 'null' : String(step.data.result)}
                              </pre>
                            )}
                          </div>
                        )}

                        {/* User JS Logs Viewer */}
                        {((step.userLogs?.length > 0) || (step.data?.userLogs?.length > 0)) && (
                          <div
                            style={{
                              marginTop: '10px',
                              background: 'rgba(0, 0, 0, 0.45)',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              borderRadius: 'var(--radius-md)',
                              padding: '10px 14px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', color: '#c084fc', fontWeight: 600 }}>
                              <Terminal size={14} /> Logs da Função ({((step.userLogs || step.data?.userLogs) || []).length}):
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                              {((step.userLogs || step.data?.userLogs) || []).map((msg, mIdx) => (
                                <div key={mIdx} style={{ color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.04)', padding: '5px 8px', borderRadius: '4px', wordBreak: 'break-word' }}>
                                  <span style={{ color: '#c084fc', marginRight: '8px', fontWeight: 'bold' }}>&gt;</span>
                                  {msg}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {step.screenshotPath && (
                          <div
                            className="step-inline-screenshot"
                            onClick={() => setSelectedScreenshot(step.screenshotPath)}
                            title="Clique para ampliar captura da etapa"
                            style={{ marginTop: '10px' }}
                          >
                            <img src={step.screenshotPath} alt={`Print da etapa ${step.stepIndex + 1}`} />
                            <div className="step-inline-screenshot-overlay">
                              <Maximize2 size={13} />
                              <span>Ver Captura de Tela</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>

      {/* Lightbox Modal for Fullscreen Screenshots */}
      {selectedScreenshot && (
        <div className="screenshot-lightbox-overlay" onClick={() => setSelectedScreenshot(null)}>
          <div className="screenshot-lightbox-container" onClick={e => e.stopPropagation()}>
            <div className="screenshot-lightbox-header">
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Camera size={15} color="var(--color-primary)" />
                Visualização da Captura de Tela
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={selectedScreenshot}
                  download
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '4px 8px', gap: '4px', display: 'inline-flex', alignItems: 'center' }}
                  title="Baixar imagem em resolução original"
                >
                  <Download size={13} /> Baixar
                </a>
                <button
                  type="button"
                  className="btn-icon-subtle"
                  onClick={() => setSelectedScreenshot(null)}
                  title="Fechar visualização"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            <div className="screenshot-lightbox-body">
              <img
                src={selectedScreenshot}
                alt="Captura ampliada"
                className="screenshot-lightbox-img"
              />
            </div>
          </div>
        </div>
      )}

      {/* Agent Skill Modal */}
      {showSkillModal && (
        <AgentSkillModal onClose={() => setShowSkillModal(false)} />
      )}
    </div>
  );
}
