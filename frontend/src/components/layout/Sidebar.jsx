import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Workflow,
  Calendar,
  FileText,
  Settings,
  Bot,
  FlaskConical,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function Sidebar({ activeTab, onSelectTab, isCollapsed = false, onToggleCollapse }) {
  const { tasks, blocks, schedules, activeRuns } = useData();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'blocks',
      label: 'Blocos de Ação',
      icon: Boxes,
      badge: blocks.length > 0 ? blocks.length : null
    },
    {
      id: 'sandbox',
      label: 'Live Sandbox',
      icon: FlaskConical,
      badge: 'Studio',
      badgeColor: 'var(--color-primary)'
    },
    {
      id: 'tasks',
      label: 'Pipelines (Tarefas)',
      icon: Workflow,
      badge: tasks.length > 0 ? tasks.length : null
    },
    {
      id: 'scheduler',
      label: 'Agendamentos',
      icon: Calendar,
      badge: schedules.filter(s => s.enabled).length > 0 ? `${schedules.filter(s => s.enabled).length} ativos` : null
    },
    {
      id: 'logs',
      label: 'Execuções & Logs',
      icon: FileText,
      badge: activeRuns.length > 0 ? `${activeRuns.length} rodando` : null,
      badgeColor: activeRuns.length > 0 ? 'var(--color-primary)' : null,
      pulse: activeRuns.length > 0
    },
    { id: 'system', label: 'Sistema', icon: Settings }
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="logo-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexGrow: 1 }}>
          <Bot size={28} color="var(--color-secondary)" style={{ flexShrink: 0 }} />
          {!isCollapsed && (
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <h1 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>AutoRPA</h1>
              <span style={{ fontSize: '10px', color: 'var(--text-dark)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                v2.0 Orchestrator
              </span>
            </div>
          )}
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral (apenas ícones)'}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
      </div>

      <nav className="nav-links">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
              role="button"
              tabIndex={0}
              title={isCollapsed ? item.label : undefined}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelectTab(item.id); }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!isCollapsed && <span style={{ flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}

              {item.pulse && (
                <span className="active-pulse-dot" style={{ marginRight: isCollapsed ? 0 : '4px' }} />
              )}

              {!isCollapsed && item.badge && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '12px',
                    backgroundColor: item.badgeColor ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                    color: item.badgeColor ? '#60a5fa' : 'var(--text-muted)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {!isCollapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)' }} />
              <span>Motor RPA Ativo</span>
            </div>
            <div>Playwright Chromium • AES-256</div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4px 0' }} title="Motor RPA Ativo (Playwright Chromium • AES-256)">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)', display: 'block' }} />
          </div>
        )}
      </div>
    </aside>
  );
}
