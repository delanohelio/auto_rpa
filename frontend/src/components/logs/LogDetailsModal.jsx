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
  Maximize2
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

  if (!log && loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={{ textAlign: 'center', padding: '60px' }}>
          <RefreshCw className="spin" size={32} color="var(--color-primary)" style={{ margin: '0 auto 16px' }} />
          <p className="text-muted">Carregando relatório da execução...</p>
        </div>
      </div>
    );
  }

  if (!log) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
        <XCircle className="modal-close" size={24} onClick={onClose} />

        <h3 className="modal-title">Detalhe da Execução: {log.taskName}</h3>

        {/* Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <p className="stat-title">Status Final</p>
            <span
              className={`badge ${log.status === 'success' ? 'badge-success' : log.status === 'failure' ? 'badge-danger' : 'badge-warning'}`}
              style={{ fontSize: '13px', marginTop: '4px' }}
            >
              {log.status === 'success' ? 'Sucesso' : log.status === 'failure' ? 'Falha' : 'Executando'}
            </span>
          </div>

          <div className="card" style={{ padding: '16px' }}>
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

          <div className="card" style={{ padding: '16px' }}>
            <p className="stat-title">Duração</p>
            <p style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
              {log.status === 'running' ? 'Executando...' : `${log.duration} segundos`}
            </p>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <p className="stat-title">Período</p>
            <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Início: {new Date(log.startedAt).toLocaleString('pt-BR')} <br />
              Fim: {log.endedAt ? new Date(log.endedAt).toLocaleString('pt-BR') : '-'}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {log.error && (
          <div className="badge badge-danger mb-24" style={{ width: '100%', borderRadius: '8px', padding: '14px 18px', textTransform: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <AlertCircle size={16} /> Erro de Execução (Halter)
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{log.error}</div>
          </div>
        )}

        {/* Interactive Prompt Card (Human in the Loop) */}
        {log.status === 'running' && (() => {
          const promptStep = (log.stepsExecuted || []).find(
            s => s.status === 'running' && s.data && s.data.isUserPrompt && !s.data.completed
          );
          if (!promptStep) return null;

          const promptVars = promptStep.data.vars || [];
          const dynamicData = promptStep.data.dynamicData;

          return (
            <div className="card mb-24" style={{ border: '2px solid var(--color-primary)', background: 'rgba(59, 130, 246, 0.08)', padding: '20px' }}>
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
        <h4 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginTop: '16px' }}>
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

                  {/* Formatted JSON Output with JsonViewer */}
                  {step.data && (
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

                  {/* File Download Button */}
                  {step.downloadPath && (
                    <div style={{ marginTop: '10px' }}>
                      <a
                        href={step.downloadPath}
                        download={step.downloadName || 'download'}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                      >
                        <Download size={13} /> Baixar Arquivo Gerado ({step.downloadName})
                      </a>
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
