import React, { useState } from 'react';
import { XCircle, Clock, Calendar, HelpCircle } from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function ScheduleEditorModal({ schedule, onSave, onClose }) {
  const { tasks } = useData();

  const [editingSchedule, setEditingSchedule] = useState(() => {
    return JSON.parse(JSON.stringify(schedule || {
      taskId: tasks[0]?.id || '',
      cronExpression: '0 * * * *',
      enabled: true
    }));
  });

  const cronPresets = [
    { label: 'A cada 15 minutos', expr: '*/15 * * * *' },
    { label: 'A cada 30 minutos', expr: '*/30 * * * *' },
    { label: 'A cada hora (minuto 0)', expr: '0 * * * *' },
    { label: 'Diariamente às 08:00', expr: '0 8 * * *' },
    { label: 'Diariamente às 22:00', expr: '0 22 * * *' },
    { label: 'Segunda a Sexta às 09:00', expr: '0 9 * * 1-5' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingSchedule.taskId) {
      alert('Selecione uma pipeline para agendar.');
      return;
    }
    if (!editingSchedule.cronExpression.trim()) {
      alert('Informe a expressão cron.');
      return;
    }
    onSave(editingSchedule);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <XCircle className="modal-close" size={24} onClick={onClose} />

        <h3 className="modal-title">
          {editingSchedule.id ? 'Editar Agendamento Cron' : 'Novo Agendamento Periódico'}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Target Pipeline Selection */}
          <div className="form-group">
            <label>Pipeline Alvo *</label>
            <select
              className="form-control"
              value={editingSchedule.taskId}
              onChange={e => setEditingSchedule({ ...editingSchedule, taskId: e.target.value })}
              required
            >
              <option value="">-- Selecione uma pipeline --</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.blocks?.length || 0} blocos)
                </option>
              ))}
            </select>
          </div>

          {/* Cron Expression Presets */}
          <div className="form-group">
            <label>Modelos Rápidos de Recorrência</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {cronPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`btn btn-sm ${editingSchedule.cronExpression === preset.expr ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setEditingSchedule({ ...editingSchedule, cronExpression: preset.expr })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Cron Expression Input */}
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Expressão Cron Personalizada *</span>
              <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>minuto hora dia mês dia_semana</span>
            </label>
            <input
              type="text"
              className="form-control"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}
              placeholder="*/30 * * * *"
              value={editingSchedule.cronExpression}
              onChange={e => setEditingSchedule({ ...editingSchedule, cronExpression: e.target.value })}
              required
            />
          </div>

          {/* Enabled Checkbox */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={editingSchedule.enabled !== false}
                onChange={e => setEditingSchedule({ ...editingSchedule, enabled: e.target.checked })}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Ativar agendamento imediatamente</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar Agendamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
