import React, { useState, useEffect } from 'react';
import { XCircle, Play, HelpCircle, Monitor, Eye, Variable, AlertTriangle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { castVariableValue, getDefaultValueForType } from '../../utils/variableTypes';
import TypedVariableInput from '../common/TypedVariableInput';

export default function TaskRunModal({ task, onStartRun, onClose }) {
  const { blocks } = useData();
  const [runOverrides, setRunOverrides] = useState({});

  // Check if any block in this pipeline contains manual_interaction (Requirement 3.1)
  const hasManualInteraction = Boolean(task?.blocks?.some(instance => {
    const blkId = instance.blockId || instance;
    const blk = blocks.find(b => b.id === blkId);
    return blk?.steps?.some(s => s.type === 'manual_interaction' || s.type === 'user_interaction' || s.type === 'interacao_manual');
  }));

  // Check if any block has user_prompt steps (Requirement 3.2)
  const hasPromptSteps = Boolean(task?.blocks?.some(instance => {
    const blkId = instance.blockId || instance;
    const blk = blocks.find(b => b.id === blkId);
    return blk?.steps?.some(s => s.type === 'user_prompt');
  }));

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

  // Execution variables initial state (Requirement 2)
  const [runExecutionVars, setRunExecutionVars] = useState(() => {
    const initial = {};
    (task?.executionVariables || []).forEach(v => {
      initial[v.name] = v.defaultValue !== undefined && v.defaultValue !== ''
        ? v.defaultValue
        : getDefaultValueForType(v.type || 'text', v.options);
    });
    return initial;
  });

  // Calculate if headless is blocked (Requirements 3.1 & 3.2)
  const totalPromptVarsCount = Object.keys(runTaskVars).length;
  const skippedPromptVarsCount = Object.values(runSkipVars).filter(Boolean).length;
  const hasUnskippedPrompt = hasPromptSteps && (totalPromptVarsCount === 0 || skippedPromptVarsCount < totalPromptVarsCount);
  const isHeadlessBlocked = hasManualInteraction || hasUnskippedPrompt;

  const [browserMode, setBrowserMode] = useState(() => isHeadlessBlocked ? 'headed' : 'headless');

  // If headless becomes blocked dynamically (e.g. user unchecks a skip checkbox), auto-switch to headed
  useEffect(() => {
    if (isHeadlessBlocked && browserMode === 'headless') {
      setBrowserMode('headed');
    }
  }, [isHeadlessBlocked, browserMode]);

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

    // Cast execution variables according to their defined types
    const finalExecutionVars = {};
    (task.executionVariables || []).forEach(v => {
      const rawVal = runExecutionVars[v.name] !== undefined ? runExecutionVars[v.name] : v.defaultValue;
      finalExecutionVars[v.name] = castVariableValue(rawVal, v.type || 'text');
    });

    const isHeadless = !isHeadlessBlocked && browserMode === 'headless';

    onStartRun(cleanedOverrides, runTaskVars, cleanedSkipList, {
      headless: isHeadless,
      liveView: !isHeadless,
      executionVariables: finalExecutionVars
    }, finalExecutionVars);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1150 }}>
      <div className="modal-content" style={{ maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="modal-header">
          <h3 className="modal-title">Configurar Execução: {task.name}</h3>
          <XCircle className="modal-close" size={24} onClick={onClose} />
          <p className="text-muted" style={{ fontSize: '13px', margin: '8px 0 0' }}>
            Defina o modo de navegação e os valores de parâmetros e variáveis para esta rodada.
          </p>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body">
          {/* Browser Mode Config Card */}
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
                  Modo de Execução
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: browserMode === 'headless' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: browserMode === 'headless' ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                    cursor: isHeadlessBlocked ? 'not-allowed' : 'pointer',
                    opacity: isHeadlessBlocked ? 0.45 : 1,
                    color: browserMode === 'headless' ? '#93c5fd' : 'var(--text-muted)',
                    fontWeight: browserMode === 'headless' ? 600 : 400
                  }}
                  title={isHeadlessBlocked ? 'Modo Headless não permitido para esta pipeline.' : 'Executar em segundo plano'}
                >
                  <input
                    type="radio"
                    name="browserMode"
                    value="headless"
                    checked={browserMode === 'headless'}
                    disabled={isHeadlessBlocked}
                    onChange={() => !isHeadlessBlocked && setBrowserMode('headless')}
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
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: browserMode === 'headed' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: browserMode === 'headed' ? '1px solid #a855f7' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    color: browserMode === 'headed' ? '#d8b4fe' : 'var(--text-muted)',
                    fontWeight: browserMode === 'headed' ? 600 : 400
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

            {/* Explanatory alerts for Requirement 3 */}
            {hasManualInteraction && (
              <div style={{ fontSize: '11px', color: '#facc15', background: 'rgba(234, 179, 8, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(234, 179, 8, 0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={15} color="#facc15" />
                <span>
                  Esta pipeline contém uma ação de <strong>Interação Manual</strong>. O modo Headless está desabilitado; a execução deve ser no modo <strong>Headed (Visual)</strong>.
                </span>
              </div>
            )}

            {!hasManualInteraction && hasUnskippedPrompt && (
              <div style={{ fontSize: '11px', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={15} color="#60a5fa" />
                <span>
                  Esta pipeline possui um <strong>Menu Interativo</strong> pendente de preenchimento. Para permitir o modo Headless, marque <em>"Pular pausa interativa"</em> em todas as variáveis interativas abaixo.
                </span>
              </div>
            )}

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              {browserMode === 'headless' ? (
                <span>
                  ⚡ <strong>Modo Headless:</strong> Acompanhamento travado em <strong>1 coluna</strong> exibindo exclusivamente os logs e as capturas de tela (screenshots).
                </span>
              ) : (
                <span>
                  🖥️ <strong>Modo Headed:</strong> Acompanhamento travado em <strong>2 colunas</strong> exibindo os logs à esquerda e o navegador em tempo real à direita.
                </span>
              )}
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
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>
                            Tipo: {param.type || 'text'}{param.description ? ` • ${param.description}` : ''}
                          </span>
                        </label>
                        <TypedVariableInput
                          type={param.type || 'text'}
                          value={runOverrides[instance.id]?.[param.name] ?? ''}
                          onChange={val => {
                            setRunOverrides(prev => ({
                              ...prev,
                              [instance.id]: {
                                ...(prev[instance.id] || {}),
                                [param.name]: val
                              }
                            }));
                          }}
                          options={param.options}
                          placeholder={placeholder}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Execution variables initial values (Requirement 2) */}
          {(task.executionVariables || []).length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(168, 85, 247, 0.04)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(168, 85, 247, 0.25)'
              }}
            >
              <h4 style={{ fontSize: '13px', color: '#c084fc', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Variable size={15} /> Variáveis de Execução (Valores Iniciais)
              </h4>
              <p className="text-muted" style={{ fontSize: '11px', marginBottom: '12px' }}>
                Defina ou ajuste os valores iniciais das variáveis globais desta pipeline antes de iniciar a execução.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {task.executionVariables.map((v, vIdx) => (
                  <div key={vIdx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '12px', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', margin: 0 }}>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#d8b4fe' }}>vars.{v.name}</span>
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>
                        Tipo: {v.type || 'text'}{v.description ? ` • ${v.description}` : ''}
                      </span>
                    </label>
                    <TypedVariableInput
                      type={v.type || 'text'}
                      value={runExecutionVars[v.name]}
                      onChange={val => setRunExecutionVars(prev => ({ ...prev, [v.name]: val }))}
                      options={v.options}
                      placeholder={v.defaultValue !== undefined ? String(v.defaultValue) : ''}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

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
                Você pode pré-preencher variáveis para evitar que a pipeline pause durante a execução. Marcar "Pular" em todas permite executar no modo Headless.
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
