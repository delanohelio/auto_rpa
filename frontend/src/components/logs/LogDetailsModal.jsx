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
  Globe
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import JsonViewer from '../code/JsonViewer';
import HtmlViewerModal from '../code/HtmlViewerModal';

export default function LogDetailsModal({ logId, onClose, onRefreshList }) {
  const { apiFetch } = useAuth();
  const toast = useToast();

  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [viewingHtml, setViewingHtml] = useState(null);
  const [copiedEvalIdx, setCopiedEvalIdx] = useState(null);

  // Live Stream & 2-Column Layout State
  const [streamKey, setStreamKey] = useState(Date.now());
  const [isTwoColumns, setIsTwoColumns] = useState(true);

  // Interactive Prompt & Manual State
  const [promptFormValues, setPromptFormValues] = useState({});
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);

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

  // Dispatch mouse click on live browser screen during manual interaction
  const handleBrowserClick = async (e) => {
    if (!manualStep) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const normalizedX = Math.round((clickX / rect.width) * 1280);
    const normalizedY = Math.round((clickY / rect.height) * 720);

    try {
      await apiFetch(`/api/runs/${log.id}/interact`, {
        method: 'POST',
        body: JSON.stringify({ type: 'click', x: normalizedX, y: normalizedY })
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

  const showTwoColumns = isTwoColumns && (log.status === 'running' || log.liveView !== false || log.screenshotPath);
  const streamUrl = `/api/runs/${log.id}/stream?t=${streamKey}${localStorage.getItem('systemPassword') ? `&token=${encodeURIComponent(localStorage.getItem('systemPassword'))}` : ''}`;

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

            {/* Toggle 2-Columns vs 1-Column */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsTwoColumns(prev => !prev)}
                title={isTwoColumns ? 'Alternar para visualização clássica (1 coluna)' : 'Alternar para visualização com navegador (2 colunas em tela cheia)'}
                style={{ fontSize: '12px', gap: '6px' }}
              >
                <Columns size={13} color={isTwoColumns ? 'var(--color-primary)' : 'var(--text-muted)'} />
                <span>{isTwoColumns ? '2 Colunas (Navegador)' : '1 Coluna'}</span>
              </button>
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
                      className={`badge ${log.status === 'success' ? 'badge-success' : log.status === 'failure' ? 'badge-danger' : 'badge-warning'}`}
                      style={{ fontSize: '12px' }}
                    >
                      {log.status === 'success' ? 'Sucesso' : log.status === 'failure' ? 'Falha' : 'Executando'}
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
                    ) : log.status === 'running' ? (
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={12} /> Interação Bloqueada
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

                {/* Viewport & Screencast Player */}
                <div className="execution-browser-viewport">
                  {log.status === 'running' ? (
                    <>
                      <img
                        key={streamKey}
                        src={streamUrl}
                        alt="Transmissão ao vivo do navegador"
                        className={`execution-stream-image ${manualStep ? 'interactive-enabled' : ''}`}
                        onClick={handleBrowserClick}
                        onError={() => {
                          // Auto-retry stream after brief pause instead of hiding permanently
                          setTimeout(() => {
                            setStreamKey(Date.now());
                          }, 1500);
                        }}
                      />

                      {/* Lock Overlay when executing automatic actions (Requirement 1.1) */}
                      {!manualStep && (
                        <div className="browser-lock-overlay">
                          <div className="browser-lock-card">
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: 'rgba(59, 130, 246, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}>
                              <Lock size={18} color="var(--color-primary)" />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: '#fff', marginBottom: '3px' }}>
                                Execução Automática em Andamento
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                O robô está controlando a página. O navegador está bloqueado para interação durante as ações automáticas.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Finished Run View: Show final screenshot if available */
                    log.screenshotPath ? (
                      <img
                        src={log.screenshotPath}
                        alt="Captura final do navegador"
                        className="execution-stream-image"
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        <Eye size={32} color="var(--text-dark)" />
                        <span>Execução finalizada. Nenhuma captura de tela registrada.</span>
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
                  <p className="stat-title">Horário de Conclusão</p>
                  <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {log.endedAt ? new Date(log.endedAt).toLocaleString('pt-BR') : 'Ainda em execução'}
                  </p>
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
    </div>
  );
}
