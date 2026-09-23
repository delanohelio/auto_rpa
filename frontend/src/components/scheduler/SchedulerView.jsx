import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Play,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import ScheduleEditorModal from './ScheduleEditorModal';
import TaskRunModal from '../tasks/TaskRunModal';

export default function SchedulerView({ onNavigateToLogs }) {
  const { schedules, tasks, saveSchedule, deleteSchedule, triggerScheduleRun } = useData();
  const toast = useToast();

  const [editingSchedule, setEditingSchedule] = useState(null);
  const [runningSchedule, setRunningSchedule] = useState(null);

  const handleToggleEnable = async (schedule) => {
    try {
      await saveSchedule({ ...schedule, enabled: !schedule.enabled });
    } catch (_) {}
  };

  const handleStartScheduleRun = async (overrides, runtimeVars, skipVars, options) => {
    if (!runningSchedule) return;
    try {
      const data = await triggerScheduleRun(runningSchedule.id, overrides, runtimeVars, skipVars, options);
      setRunningSchedule(null);
      onNavigateToLogs?.(data?.runId);
    } catch (_) {}
  };

  return (
    <div>
      <div className="header-section">
        <div>
          <h2>Agendador de Tarefas Automáticas (Cron)</h2>
          <p>Configure execuções autônomas periódicas em segundo plano</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setEditingSchedule({ taskId: tasks[0]?.id || '', cronExpression: '0 * * * *', enabled: true })}
          disabled={tasks.length === 0}
        >
          <Plus size={14} /> Novo Agendamento
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Calendar size={36} color="var(--text-dark)" style={{ margin: '0 auto 12px' }} />
          <p className="text-muted">
            Você precisa criar pelo menos uma pipeline antes de configurar agendamentos.
          </p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Clock size={36} color="var(--text-dark)" style={{ margin: '0 auto 12px' }} />
          <p className="text-muted">Nenhum agendamento cron cadastrado no momento.</p>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: '16px' }}
            onClick={() => setEditingSchedule({ taskId: tasks[0]?.id || '', cronExpression: '0 * * * *', enabled: true })}
          >
            <Plus size={12} /> Criar Primeiro Agendamento
          </button>
        </div>
      ) : (
        <div className="list-wrapper">
          {schedules.map(schedule => {
            const task = tasks.find(t => t.id === schedule.taskId);
            return (
              <div key={schedule.id} className="list-item">
                <div className="list-item-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3>{task ? task.name : 'Pipeline Desconhecida'}</h3>
                    {schedule.enabled ? (
                      <span className="badge badge-success">
                        <CheckCircle2 size={10} /> Ativo
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-dark)', border: '1px solid var(--border-color)' }}>
                        <XCircle size={10} /> Pausado
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} color="var(--color-secondary)" />
                      <code style={{ color: 'var(--color-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {schedule.cronExpression}
                      </code>
                    </div>

                    {schedule.nextRun && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        Próxima execução: <strong>{new Date(schedule.nextRun).toLocaleString('pt-BR')}</strong>
                      </div>
                    )}
                  </div>

                  {schedule.lastRun && (
                    <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '4px' }}>
                      Último disparo: {new Date(schedule.lastRun).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>

                <div className="list-item-meta">
                  <div className="gap-8">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleToggleEnable(schedule)}
                      title={schedule.enabled ? 'Pausar Agendamento' : 'Ativar Agendamento'}
                    >
                      {schedule.enabled ? 'Pausar' : 'Ativar'}
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingSchedule(schedule)}
                      title="Editar Agendamento"
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        // If task has parameters, open run modal, else run directly
                        if (task && task.blocks?.length > 0) {
                          setRunningSchedule(schedule);
                        } else {
                          triggerScheduleRun(schedule.id);
                          onNavigateToLogs?.();
                        }
                      }}
                      title="Disparar Imediatamente"
                    >
                      <Play size={13} /> Executar Agora
                    </button>

                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (window.confirm('Deseja excluir este agendamento?')) {
                          deleteSchedule(schedule.id);
                        }
                      }}
                      title="Excluir Agendamento"
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

      {/* Schedule Editor Modal */}
      {editingSchedule && (
        <ScheduleEditorModal
          schedule={editingSchedule}
          onSave={async (saved) => {
            await saveSchedule(saved);
            setEditingSchedule(null);
          }}
          onClose={() => setEditingSchedule(null)}
        />
      )}

      {/* Task Run Modal when triggering scheduled task with params */}
      {runningSchedule && (() => {
        const targetTask = tasks.find(t => t.id === runningSchedule.taskId);
        if (!targetTask) return null;
        return (
          <TaskRunModal
            task={targetTask}
            onStartRun={handleStartScheduleRun}
            onClose={() => setRunningSchedule(null)}
          />
        );
      })()}
    </div>
  );
}
