import React, { useState } from 'react';
import { XCircle, Play, HelpCircle, Monitor, Eye } from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function TaskRunModal({ task, onStartRun, onClose }) {
  const { blocks } = useData();
  const [runOverrides, setRunOverrides] = useState({});

  // Check if any block in this pipeline contains manual_interaction (Requirement 1.1)
  const hasManualInteraction = Boolean(task?.blocks?.some(instance => {
    const blkId = instance.blockId || instance;
    const blk = blocks.find(b => b.id === blkId);
    return blk?.steps?.some(s => s.type === 'manual_interaction' || s.type === 'user_interaction' || s.type === 'interacao_manual');
  }));

  const [browserMode, setBrowserMode] = useState(() => hasManualInteraction ? 'headed' : 'headless');
  const [liveView, setLiveView] = useState(true);
  const [runTaskVars, setRunTaskVars] = useState(() => {
    const promptVars = {};
    if (task && task.blocks) {
      task.blocks.forEach(instance => {
        const blk = blocks.find(b => b.id === instance.blockId);
        if (blk && blk.steps) {
          blk.steps.forEach(st => {
            if (st.type === 'user_prompt' && Array.isArray(st.vars)) {
              st.vars.forEach(v => {
                promptVars[v.name] = v.defaultValue || '';
              });
            }
          });
        }
      });
    }
    return promptVars;
  });
  const [runSkipVars, setRunSkipVars] = useState({});

  const handleConfirm = () => {
    // Clean empty overrides
    const cleanedOverrides = {};
    Object.entries(runOverrides).forEach(([instId, params]) => {
      const blockOverrides = {};
      Object.entries(params).forEach(([pName, pVal]) => {
        if (pVal !== undefined && pVal !== '') {
          blockOverrides[pName] = pVal;
        }
      });
      if (Object.keys(blockOverrides).length > 0) {
        cleanedOverrides[instId] = blockOverrides;
      }
    });

    const cleanedSkipList = Object.entries(runSkipVars)
      .filter(([_, isSkip]) => isSkip)
      .map(([vName]) => vName);

    onStartRun(cleanedOverrides, runTaskVars, cleanedSkipList, {
      headless: browserMode === 'headless',
      liveView
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1150 }}>
      <div className="modal-content" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="modal-header">
          <h3 className="modal-title">Configurar Execução: {task.name}</h3>
          <XCircle className="modal-close" size={24} onClick={onClose} />
          <p className="text-muted" style={{ fontSize: '13px', margin: '8px 0 0' }}>
            Defina o modo de navegação, visualização ao vivo e valores de parâmetros para esta rodada.
          </p>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body">
          {/* Browser Mode & Live View Config Card */}
          <div
            style={{
              padding: '14px 16px',
              background: 'rgba(59, 130, 246, 0.04)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Monitor size={16} color="var(--color-primary)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-light)' }}>
                  Modo do Navegador
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: browserMode === 'headless' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: browserMode === 'headless' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    color: browserMode === 'headless' ? '#93c5fd' : 'var(--text-muted)'
                  }}
                >
                  <input
                    type="radio"
                    name="browserMode"
                    value="headless"
                    checked={browserMode === 'headless'}
                    onChange={() => setBrowserMode('headless')}
                    style={{ margin: 0 }}
                  />
                  Headless (Segundo Plano)
                </label>

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: browserMode === 'headed' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: browserMode === 'headed' ? '1px solid #a855f7' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    color: browserMode === 'headed' ? '#d8b4fe' : 'var(--text-muted)'
                  }}
                >
                  <input
                    type="radio"
                    name="browserMode"
                    value="headed"
                    checked={browserMode === 'headed'}
                    onChange={() => setBrowserMode('headed')}
                    style={{ margin: 0 }}
                  />
                  Headed (Visual)
                </label>
              </div>
            </div>

            {hasManualInteraction && (
              <div style={{ fontSize: '11px', color: '#facc15', background: 'rgba(234, 179, 8, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(234, 179, 8, 0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px' }}>💡</span>
                <span>
                  Esta pipeline contém uma ação de <strong>Interação Manual</strong>. O modo visual (Headed) é recomendado para interação física. Em ambientes de servidor/Docker sem display X11, o AutoRPA utiliza automaticamente Xvfb ou LiveView sem travar a execução.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={15} color="var(--color-secondary)" />
                <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                  Acompanhar Navegador ao Vivo (Screencast em Tempo Real)
                </span>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={liveView}
                  onChange={e => setLiveView(e.target.checked)}
                />
                <span style={{ color: liveView ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {liveView ? 'Ativo' : 'Desativado'}
                </span>
              </label>
            </div>
          </div>

          {/* Blocks parameters override */}
          {(task.blocks || []).map((instance, index) => {
            const block = blocks.find(b => b.id === instance.blockId);
            if (!block || !block.parameters || block.parameters.length === 0) return null;

            return (
              <div
                key={instance.id || index}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <h4 style={{ fontSize: '13px', color: 'var(--color-secondary)', fontWeight: 700, marginBottom: '10px' }}>
                  Etapa {index + 1}: {block.name}
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {block.parameters.map((param, pIdx) => {
                    const staticValue = instance.parameterValues?.[param.name] || '';
                    const placeholder = staticValue ? `Pipeline: "${staticValue}"` : `Padrão: "${param.defaultValue}"`;

                    return (
                      <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '12px', alignItems: 'center' }}>
                        <label style={{ fontSize: '12px', margin: 0 }}>
                          <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{param.name}</span>
                          {param.description && (
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{param.description}</span>
                          )}
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ fontSize: '12px', padding: '6px 10px' }}
                          placeholder={placeholder}
                          value={runOverrides[instance.id]?.[param.name] || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setRunOverrides(prev => ({
                              ...prev,
                              [instance.id]: {
                                ...(prev[instance.id] || {}),
                                [param.name]: val
                              }
                            }));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Interactive prompt variables */}
          {Object.keys(runTaskVars).length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(59, 130, 246, 0.05)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}
            >
              <h4 style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={15} /> Variáveis de Prompt Interativo
              </h4>
              <p className="text-muted" style={{ fontSize: '11px', marginBottom: '12px' }}>
                Você pode pré-preencher variáveis para evitar que a pipeline pause durante a execução.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.keys(runTaskVars).map(varName => (
                  <div key={varName} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {varName}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={!!runSkipVars[varName]}
                          onChange={e => {
                            const isChecked = e.target.checked;
                            setRunSkipVars(prev => ({ ...prev, [varName]: isChecked }));
                          }}
                        />
                        Pular pausa interativa desta variável
                      </label>
                    </div>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '12px', padding: '6px 10px' }}
                      placeholder="Valor pré-definido"
                      value={runTaskVars[varName] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setRunTaskVars(prev => ({ ...prev, [varName]: val }));
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            <Play size={14} /> Confirmar e Iniciar
          </button>
        </div>
      </div>
    </div>
  );
}
