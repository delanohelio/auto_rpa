import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Workflow,
  Boxes,
  Play,
  ChevronRight,
  Plus,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function DashboardView({ onNavigate, onTriggerTask }) {
  const { stats, activeRuns, tasks, blocks } = useData();

  return (
    <div>
      <div className="header-section">
        <div>
          <h2>Painel de Controle AutoRPA</h2>
          <p>Visão geral da infraestrutura, taxas de sucesso e execuções em tempo real</p>
        </div>

        <div className="gap-8">
          <button className="btn btn-secondary" onClick={() => onNavigate('blocks')}>
            <Boxes size={14} /> Novo Bloco
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('tasks')}>
            <Plus size={14} /> Nova Pipeline
          </button>
        </div>
      </div>

      {/* Active Running Pipelines Alert Card */}
      {activeRuns.length > 0 && (
        <div
          className="card mb-24"
          style={{
            border: '2px solid var(--color-primary)',
            background: 'rgba(59, 130, 246, 0.08)',
            padding: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="active-pulse-dot" style={{ width: '12px', height: '12px' }} />
              <div>
                <h4 style={{ fontSize: '16px', color: 'var(--text-main)', margin: 0 }}>
                  {activeRuns.length} {activeRuns.length === 1 ? 'Pipeline em Execução' : 'Pipelines em Execução'}
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  {activeRuns.some(r => r.waitingForPrompt)
                    ? 'Há automações aguardando preenchimento interativo de variáveis!'
                    : activeRuns.some(r => r.waitingForAgent)
                    ? 'Automação pausada aguardando controle de agente de IA.'
                    : 'Navegador Playwright operando em tempo real.'}
                </p>
              </div>
            </div>

            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('logs')}>
              Ver Execuções em Andamento <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        <div className="card">
          <div className="stat-title">Taxa de Sucesso</div>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {stats.successRate}%
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-sub">De {stats.totalRuns} execuções registradas</div>
        </div>

        <div className="card">
          <div className="stat-title">Execuções Concluídas</div>
          <div className="stat-value">
            {stats.successCount}
            <span style={{ fontSize: '14px', color: 'var(--color-danger)', fontWeight: 'normal' }}>
              / {stats.failureCount} falhas
            </span>
          </div>
          <div className="stat-sub">Tempo médio: {stats.averageDurationSeconds}s</div>
        </div>

        <div className="card">
          <div className="stat-title">Pipelines Cadastradas</div>
          <div className="stat-value" style={{ color: 'var(--color-secondary)' }}>
            {stats.totalTasks}
            <Workflow size={20} />
          </div>
          <div className="stat-sub">{stats.totalBlocks} blocos de ações disponíveis</div>
        </div>

        <div className="card">
          <div className="stat-title">Agendamentos Ativos</div>
          <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
            {stats.activeSchedules}
            <Clock size={20} />
          </div>
          <div className="stat-sub">Disparos periódicos autônomos</div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <h3 style={{ fontSize: '18px', marginBottom: '16px', fontWeight: 600 }}>Acesso Rápido</h3>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div
          className="card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('blocks')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ padding: '10px', background: 'var(--color-primary-glow)', borderRadius: 'var(--radius-md)' }}>
              <Boxes size={22} color="var(--color-primary)" />
            </div>
            <div>
              <h4 style={{ fontSize: '16px', margin: 0 }}>Blocos de Ação</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Módulos de etapas reutilizáveis</p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Crie e edite etapas de navegação, cliques, digitação, scripts JS com verificação de sintaxe e variáveis criptografadas.
          </p>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('tasks')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ padding: '10px', background: 'var(--color-secondary-glow)', borderRadius: 'var(--radius-md)' }}>
              <Workflow size={22} color="var(--color-secondary)" />
            </div>
            <div>
              <h4 style={{ fontSize: '16px', margin: 0 }}>Pipelines</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Encadeamento de fluxos RPA</p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Sequencie blocos de ação, defina sobrescritas de parâmetros dinâmicos e configure anti-detecção de bots.
          </p>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('scheduler')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ padding: '10px', background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-md)' }}>
              <Clock size={22} color="var(--color-warning)" />
            </div>
            <div>
              <h4 style={{ fontSize: '16px', margin: 0 }}>Agendador Cron</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Execuções automáticas periódicas</p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Programe tarefas com regras cron em linguagem natural para execução contínua em background sem intervenção humana.
          </p>
        </div>
      </div>

      {/* Recent Pipelines Quick Run Table */}
      <div className="card mt-24">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Pipelines Prontas para Disparo</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Inicie tarefas manualmente com um clique</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('tasks')}>
            Ver Todas ({tasks.length})
          </button>
        </div>

        {tasks.length === 0 ? (
          <p className="text-muted" style={{ padding: '24px 0', textAlign: 'center' }}>
            Nenhuma pipeline cadastrada ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tasks.slice(0, 5).map(task => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{task.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {task.description || `${task.blocks?.length || 0} blocos encadeados`}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigate('tasks', task.id)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onTriggerTask(task)}
                  >
                    <Play size={12} /> Executar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
