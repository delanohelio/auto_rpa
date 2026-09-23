import React, { useState, useEffect } from 'react';
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
  Sparkles,
  Copy,
  Check,
  FileText,
  Eye,
  MousePointer
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

  // Interactive Prompt Form State
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

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '920px' }} onClick={e => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="modal-header">
          <h3 className="modal-title">Detalhes da Execução: {log.taskName}</h3>
          <XCircle className="modal-close" size={24} onClick={onClose} />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            Run ID: {log.id} &bull; Disparado em {new Date(log.startedAt).toLocaleString('pt-BR')}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body">
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

          {/* Live Browser Stream Player (Feature 0) */}
          {log.status === 'running' && (
            <div
              className="card mb-16"
              style={{
                border: '1px solid rgba(59, 130, 246, 0.4)',
                padding: '16px',
                background: 'rgba(15, 23, 42, 0.65)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="active-pulse-dot" />
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eye size={16} color="var(--color-primary)" /> Acompanhamento do Navegador em Tempo Real
                  </h4>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className="badge"
                    style={{
                      fontSize: '11px',
                      background: log.headless === false ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: log.headless === false ? '#d8b4fe' : '#60a5fa',
                      border: log.headless === false ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    {log.headless === false ? 'Modo Headed (Janela Aberta)' : 'Modo Headless (Screencast CDP)'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Transmissão ativa MJPEG
                  </span>
                </div>
              </div>

              <div
                style={{
                  width: '100%',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: '#090d16',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '280px',
                  boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                }}
              >
                <img
                  src={`/api/runs/${log.id}/stream${localStorage.getItem('systemPassword') ? `?token=${encodeURIComponent(localStorage.getItem('systemPassword'))}` : ''}`}
                  alt="Transmissão ao vivo do navegador"
                  style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', display: 'block' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextElementSibling) {
                      e.target.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
                <div
                  style={{
                    display: 'none',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '30px',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    gap: '8px'
                  }}
                >
                  <Eye size={24} color="var(--text-dark)" />
                  <span>Transmissão aguardando carregamento da primeira tela...</span>
                </div>
              </div>
            </div>
          )}

          {/* Manual Interaction Card (Human in the Loop / Free Browser Interaction) */}
          {log.status === 'running' && (() => {
            const manualStep = (log.stepsExecuted || []).find(
              s => s.status === 'running' && s.data && s.data.isManualInteraction && !s.data.completed
            );
            if (!manualStep) return null;

            return (
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

                <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  <span>💡 <strong>Atenção:</strong> A janela do Chromium foi aberta na sua área de trabalho. Resolva o Captcha, login ou ações manuais necessárias e, em seguida, clique no botão abaixo para prosseguir a automação.</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isSubmittingPrompt}
                    onClick={async () => {
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
                        toast.success('Interação Confirmada', 'Retomando a execução da pipeline...');
                        if (fetchLogDetails) fetchLogDetails();
                      } catch (err) {
                        toast.error('Erro ao continuar', err.message);
                      } finally {
                        setIsSubmittingPrompt(false);
                      }
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#9333ea', borderColor: '#a855f7' }}
                  >
                    {isSubmittingPrompt ? <RefreshCw className="spin" size={14} /> : <Play size={14} style={{ fill: 'currentColor' }} />}
                    Concluir Interação & Continuar Pipeline
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Interactive Prompt Card (Human in the Loop) */}
          {log.status === 'running' && (() => {
            const promptStep = (log.stepsExecuted || []).find(
              s => s.status === 'running' && s.data && s.data.isUserPrompt && !s.data.completed
            );
            if (!promptStep) return null;

            const promptVars = promptStep.data.vars || [];
            const dynamicData = promptStep.data.dynamicData;

            return (
              <div className="card mb-16" style={{ border: '2px solid var(--color-primary)', background: 'rgba(59, 130, 246, 0.08)', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HelpCircle size={18} /> {promptStep.data.promptTitle || 'Preenchimento Interativo de Variáveis'}
                  </h4>
                  <span className="badge badge-warning" style={{ fontSize: '11px' }}>Aguardando Usuário</span>
                </div>

                {promptStep.data.promptDescription && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    {promptStep.data.promptDescription}
                  </p>
                )}

                {/* Dynamic Extracted Options */}
                {dynamicData && !dynamicData.error && (
                  <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-secondary)', marginBottom: '4px' }}>
                      Opções Extraídas da Página em Tempo Real:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Object.entries(dynamicData).map(([key, val]) => {
                        if (Array.isArray(val)) {
                          return (
                            <span key={key} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                              {key}: {val.length} opções disponíveis
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                <form onSubmit={e => handleSubmitPrompt(e, promptVars)}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                    {promptVars.map(v => {
                      const currentValue = promptFormValues[v.name] !== undefined
                        ? promptFormValues[v.name]
                        : (v.value !== undefined ? v.value : v.defaultValue);

                      const options = dynamicData?.[`options_for_${v.name}`] || dynamicData?.[v.name] || (Array.isArray(dynamicData) ? dynamicData : null);

                      return (
                        <div key={v.name} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{v.label || v.name}</span>
                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{`{{param:${v.name}}}`}</span>
                          </label>

                          {Array.isArray(options) && options.length > 0 ? (
                            <select
                              className="form-control"
                              value={currentValue}
                              onChange={e => setPromptFormValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                              required
                            >
                              <option value="">-- Selecione uma opção extraída da página --</option>
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
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSubmittingPrompt}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      {isSubmittingPrompt ? <RefreshCw className="spin" size={14} /> : <CheckCircle2 size={14} />}
                      Confirmar e Continuar Execução
                    </button>
                  </div>
                </form>
              </div>
            );
          })()}

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
                        ? (step.type === 'agent_control' ? 'Aguardando Agente...' : 'Rodando...')
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

                        {/* Render value depending on type */}
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
                              wordBreak: 'break-word',
                              maxHeight: '220px',
                              overflowY: 'auto'
                            }}
                          >
                            {step.data.result !== undefined && step.data.result !== null
                              ? String(step.data.result)
                              : '(sem retorno / undefined)'}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Generic Non-Eval Data Output */}
                    {step.type !== 'eval' && step.data && (
                      <div style={{ marginTop: '10px' }}>
                        <strong style={{ color: 'var(--color-secondary)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          Dados Retornados / Extraídos:
                        </strong>
                        <JsonViewer data={step.data} title={`Step ${idx + 1} Retorno`} maxHeight="180px" />
                      </div>
                    )}

                    {/* Extracted HTML Button */}
                    {step.extractedHtml && (
                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setViewingHtml(step.extractedHtml)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Code size={13} /> Visualizar Código HTML Extraído
                        </button>
                      </div>
                    )}

                    {/* File Download Button (When output_file is configured) */}
                    {step.downloadPath && (
                      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <a
                          href={step.downloadPath}
                          download={step.downloadName || 'download'}
                          className="btn btn-primary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                        >
                          <Download size={13} /> Baixar Arquivo Gerado ({step.downloadName})
                        </a>
                        {step.data?.fileSize !== undefined && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ({step.data.fileSize} bytes)
                          </span>
                        )}
                      </div>
                    )}

                    {step.error && (
                      <div style={{ marginTop: '8px', color: 'var(--color-danger)' }}>
                        <strong>Falha:</strong> {step.error}
                      </div>
                    )}
                  </div>

                  {/* Step Screenshot */}
                  {step.screenshotPath && (
                    <div>
                      <p className="text-muted" style={{ fontSize: '11px', marginTop: '6px' }}>Captura visual:</p>
                      <img
                        src={step.screenshotPath}
                        alt="Visual Step Preview"
                        className="log-step-screenshot"
                        onClick={() => setSelectedScreenshot(step.screenshotPath)}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar Relatório
          </button>
        </div>

        {/* Zoom Screenshot Modal */}
        {selectedScreenshot && (
          <div className="modal-overlay" style={{ zIndex: 1250 }} onClick={() => setSelectedScreenshot(null)}>
            <div className="modal-content" style={{ maxWidth: '95vw', padding: '16px' }} onClick={e => e.stopPropagation()}>
              <XCircle className="modal-close" size={24} onClick={() => setSelectedScreenshot(null)} />
              <img
                src={selectedScreenshot}
                alt="Screenshot Zoom"
                style={{ width: '100%', height: 'auto', maxHeight: '85vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
              />
            </div>
          </div>
        )}

        {/* HTML Inspector Modal */}
        {viewingHtml && (
          <HtmlViewerModal
            html={viewingHtml}
            title={`Código HTML Extraído: ${log.taskName}`}
            onClose={() => setViewingHtml(null)}
          />
        )}
      </div>
    </div>
  );
}
