import React from 'react';
import {
  Search,
  LogOut,
  ChevronRight,
  Activity,
  Play,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export default function Header({
  activeTab,
  activeSubItem,
  onNavigate,
  onOpenCommandPalette,
  isSidebarCollapsed = false,
  onToggleSidebar
}) {
  const { authRequired, logout } = useAuth();
  const { activeRuns } = useData();

  const tabLabels = {
    dashboard: 'Dashboard',
    blocks: 'Blocos de Ação',
    sandbox: 'Live Sandbox',
    tasks: 'Pipelines',
    scheduler: 'Agendamentos',
    logs: 'Histórico & Logs',
    system: 'Sistema'
  };

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="top-header">
      {/* Breadcrumbs Navigation */}
      <div className="breadcrumbs">
        {onToggleSidebar && (
          <button
            type="button"
            className="sidebar-header-toggle"
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        )}

        <span className="breadcrumb-item" onClick={() => onNavigate('dashboard')}>
          AutoRPA
        </span>
        <ChevronRight className="breadcrumbs-separator" size={14} />

        <span
          className={`breadcrumb-item ${!activeSubItem ? 'breadcrumb-active' : ''}`}
          onClick={() => onNavigate(activeTab)}
        >
          {tabLabels[activeTab] || activeTab}
        </span>

        {activeSubItem && (
          <>
            <ChevronRight className="breadcrumbs-separator" size={14} />
            <span className="breadcrumb-item breadcrumb-active">
              {activeSubItem}
            </span>
          </>
        )}
      </div>

      {/* Header Actions */}
      <div className="header-right">
        {/* Active Runs Pulse Indicator */}
        {activeRuns.length > 0 && (
          <div
            className="active-runs-badge"
            onClick={() => onNavigate('logs')}
            title="Ver execuções em tempo real"
          >
            <span className="active-pulse-dot" />
            <span>{activeRuns.length} {activeRuns.length === 1 ? 'rodando' : 'rodando'}</span>
          </div>
        )}

        {/* Global Command Palette Trigger */}
        <button
          type="button"
          className="command-trigger-btn"
          onClick={onOpenCommandPalette}
          title="Abrir busca rápida e comandos"
        >
          <Search size={14} />
          <span>Comandos</span>
          <span className="kbd-shortcut">{isMac ? '⌘K' : 'Ctrl+K'}</span>
        </button>

        {/* Auth Logout */}
        {authRequired && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={logout}
            title="Encerrar sessão"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={14} /> Sair
          </button>
        )}
      </div>
    </header>
  );
}
