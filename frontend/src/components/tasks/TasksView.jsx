import React, { useState } from 'react';
import {
  Workflow,
  Plus,
  Play,
  Edit2,
  Trash2,
  Download,
  Upload,
  Link,
  Search,
  Shield,
  Bot,
  Code
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import TaskEditorModal from './TaskEditorModal';
import TaskRunModal from './TaskRunModal';
import CodeViewer from '../code/CodeViewer';

export default function TasksView({ initialEditingId, onClearInitialEditingId, onNavigateToLogs }) {
  const { tasks, blocks, saveTask, deleteTask, triggerTaskRun } = useData();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [runningTask, setRunningTask] = useState(null);
  const [viewingJsonTask, setViewingJsonTask] = useState(null);

  React.useEffect(() => {
    if (initialEditingId) {
      const found = tasks.find(t => t.id === initialEditingId);
      if (found) {
        setEditingTask(found);
      }
      onClearInitialEditingId?.();
    }
  }, [initialEditingId, tasks, onClearInitialEditingId]);

  const filteredTasks = tasks.filter(t => {
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q));
  });

  const handleExportTask = (task) => {
    const blob = new Blob([JSON.stringify(task, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline_${task.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Pipeline Exportada', 'Arquivo JSON gerado para download.');
  };

  const handleImportTask = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.name || (!Array.isArray(parsed.blocks) && !Array.isArray(parsed.blockIds))) {
          throw new Error('Formato de pipeline inválido.');
        }
        delete parsed.id;
        parsed.name = `${parsed.name} (Importada)`;
        await saveTask(parsed);
      } catch (err) {
        toast.error('Erro na Importação', err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyApiLink = (taskId) => {
    const url = `${window.location.origin}/api/tasks/${taskId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link Copiado', 'Endpoint da API copiado para a área de transferência.');
  };

  const handleStartTaskRun = async (overrides, runtimeVars, skipVars) => {
    if (!runningTask) return;
    try {
      await triggerTaskRun(runningTask.id, overrides, runtimeVars, skipVars);
      setRunningTask(null);
      onNavigateToLogs?.();
    } catch (_) {}
  };

  return (
    <div>
      <div className="header-section">
        <div>
          <h2>Pipelines de Automação (Tarefas)</h2>
          <p>Encadeie blocos funcionais, execute robôs e monitore o fluxo de navegação</p>
        </div>

        <div className="gap-8" style={{ flexWrap: 'wrap' }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
            <Upload size={14} /> Importar Pipeline
            <input type="file" accept=".json" onChange={handleImportTask} style={{ display: 'none' }} />
          </label>
          <button
            className="btn btn-primary"
            onClick={() => setEditingTask({ name: '', description: '', blocks: [], antiDetection: true })}
          >
            <Plus size={14} /> Montar Nova Pipeline
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="filter-search-bar">
        <div className="search-input-wrapper">
          <Search className="search-input-icon" size={16} />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar pipelines por nome ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {filteredTasks.length} {filteredTasks.length === 1 ? 'pipeline cadastrada' : 'pipelines cadastradas'}
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Workflow size={36} color="var(--text-dark)" style={{ margin: '0 auto 12px' }} />
          <p className="text-muted">
            {search ? 'Nenhuma pipeline corresponde à busca.' : 'Nenhuma pipeline configurada ainda.'}
          </p>
          {!search && (
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: '16px' }}
              onClick={() => setEditingTask({ name: '', description: '', blocks: [], antiDetection: true })}
            >
              <Plus size={12} /> Montar Primeira Pipeline
            </button>
          )}
        </div>
      ) : (
        <div className="list-wrapper">
          {filteredTasks.map(task => {
            const taskBlockInstances = task.blocks || [];
            const hasAgentControl = taskBlockInstances.some(inst => {
              const b = blocks.find(blk => blk.id === inst.blockId);
              return (b?.steps || []).some(s => s.type === 'agent_control');
            });

            return (
              <div key={task.id} className="list-item">
                <div className="list-item-info" style={{ maxWidth: '60%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3>{task.name}</h3>
                    {task.antiDetection && (
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                        <Shield size={11} /> Anti-Detecção
                      </span>
                    )}
                    {hasAgentControl && (
                      <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                        <Bot size={11} /> Handoff Agente
                      </span>
                    )}
                  </div>
                  <p>{task.description || 'Sem descrição informada.'}</p>

                  {/* Flow Breadcrumb Nodes */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {taskBlockInstances.map((inst, i) => {
                      const blk = blocks.find(b => b.id === inst.blockId);
                      return (
                        <React.Fragment key={i}>
                          <span
                            style={{
                              fontSize: '11px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid var(--border-color)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              color: 'var(--text-main)'
                            }}
                          >
                            {blk ? blk.name : 'Bloco'}
                          </span>
                          {i < taskBlockInstances.length - 1 && (
                            <span style={{ color: 'var(--text-dark)', fontSize: '10px' }}>&rarr;</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                <div className="list-item-meta">
                  <span className="badge badge-info">
                    {taskBlockInstances.length} blocos
                  </span>

                  <div className="gap-8">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setViewingJsonTask(task)}
                      title="Ver JSON da Pipeline"
                    >
                      <Code size={13} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopyApiLink(task.id)}
                      title="Copiar Link da API"
                    >
                      <Link size={13} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleExportTask(task)}
                      title="Exportar JSON"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingTask(task)}
                      title="Editar Pipeline"
                    >
                      <Edit2 size={13} /> Editar
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setRunningTask(task)}
                      title="Iniciar Execução"
                    >
                      <Play size={13} /> Executar
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (window.confirm(`Deseja excluir a pipeline "${task.name}"?`)) {
                          deleteTask(task.id);
                        }
                      }}
                      title="Excluir Pipeline"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Editor Modal */}
      {editingTask && (
        <TaskEditorModal
          task={editingTask}
          onSave={async (savedTask) => {
            await saveTask(savedTask);
            setEditingTask(null);
          }}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* Task Run Configuration Modal */}
      {runningTask && (
        <TaskRunModal
          task={runningTask}
          onStartRun={handleStartTaskRun}
          onClose={() => setRunningTask(null)}
        />
      )}

      {/* View JSON Modal */}
      {viewingJsonTask && (
        <div className="modal-overlay" onClick={() => setViewingJsonTask(null)} style={{ zIndex: 1200 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <CodeViewer
              code={viewingJsonTask}
              language="json"
              title={`Definição JSON: ${viewingJsonTask.name}`}
              maxHeight="60vh"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setViewingJsonTask(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
