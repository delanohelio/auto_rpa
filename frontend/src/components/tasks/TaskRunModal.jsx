import React, { useState } from 'react';
import { XCircle, Play, HelpCircle } from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function TaskRunModal({ task, onStartRun, onClose }) {
  const { blocks } = useData();
  const [runOverrides, setRunOverrides] = useState({});
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

    onStartRun(cleanedOverrides, runTaskVars, cleanedSkipList);
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
            Defina valores temporários para os parâmetros desta rodada. Se deixados em branco, o sistema usará as configurações padrão da pipeline.
          </p>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body">
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
