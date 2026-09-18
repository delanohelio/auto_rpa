import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { DataProvider, useData } from './context/DataContext';

import AppLayout from './components/layout/AppLayout';
import CommandPalette from './components/layout/CommandPalette';
import LoginScreen from './components/common/LoginScreen';

import DashboardView from './components/dashboard/DashboardView';
import BlocksView from './components/blocks/BlocksView';
import TasksView from './components/tasks/TasksView';
import SchedulerView from './components/scheduler/SchedulerView';
import LogsView from './components/logs/LogsView';
import SystemView from './components/system/SystemView';
import TaskRunModal from './components/tasks/TaskRunModal';

function AppContent() {
  const { isAuthenticated, authRequired, authLoading } = useAuth();
  const { blocks, tasks, triggerTaskRun } = useData();

  // Navigation State with URL synchronization
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'dashboard';
  });

  const [activeId, setActiveId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || null;
  });

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [quickRunTask, setQuickRunTask] = useState(null);

  // Synchronize navigation with browser history
  const handleNavigate = useCallback((tab, id = null) => {
    setActiveTab(tab);
    setActiveId(id);

    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    if (id) {
      url.searchParams.set('id', id);
    } else {
      url.searchParams.delete('id');
    }
    window.history.pushState({ tab, id }, '', url.toString());
  }, []);

  // Listen to popstate for browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'dashboard';
      const id = params.get('id') || null;
      setActiveTab(tab);
      setActiveId(id);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global Keyboard Shortcuts (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calculate breadcrumbs sub-item label
  const activeSubItem = React.useMemo(() => {
    if (!activeId) return null;
    if (activeTab === 'blocks') {
      const blk = blocks.find(b => b.id === activeId);
      return blk ? `Bloco: ${blk.name}` : null;
    }
    if (activeTab === 'tasks') {
      const tsk = tasks.find(t => t.id === activeId);
      return tsk ? `Pipeline: ${tsk.name}` : null;
    }
    if (activeTab === 'logs') {
      return `Execução: ${activeId.substring(0, 8)}...`;
    }
    return null;
  }, [activeTab, activeId, blocks, tasks]);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-app)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          Carregando AutoRPA 2.0...
        </div>
      </div>
    );
  }

  if (authRequired && !isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <AppLayout
      activeTab={activeTab}
      activeSubItem={activeSubItem}
      onNavigate={handleNavigate}
      onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
    >
      {activeTab === 'dashboard' && (
        <DashboardView
          onNavigate={handleNavigate}
          onTriggerTask={(task) => setQuickRunTask(task)}
        />
      )}

      {activeTab === 'blocks' && (
        <BlocksView
          initialEditingId={activeId}
          onClearInitialEditingId={() => setActiveId(null)}
        />
      )}

      {activeTab === 'tasks' && (
        <TasksView
          initialEditingId={activeId}
          onClearInitialEditingId={() => setActiveId(null)}
          onNavigateToLogs={() => handleNavigate('logs')}
        />
      )}

      {activeTab === 'scheduler' && (
        <SchedulerView
          onNavigateToLogs={() => handleNavigate('logs')}
        />
      )}

      {activeTab === 'logs' && (
        <LogsView
          initialLogId={activeId}
          onClearInitialLogId={() => setActiveId(null)}
        />
      )}

      {activeTab === 'system' && (
        <SystemView />
      )}

      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        onTriggerTask={(task) => setQuickRunTask(task)}
      />

      {/* Quick Run Modal from Dashboard or Command Palette */}
      {quickRunTask && (
        <TaskRunModal
          task={quickRunTask}
          onStartRun={async (overrides, runtimeVars, skipVars) => {
            await triggerTaskRun(quickRunTask.id, overrides, runtimeVars, skipVars);
            setQuickRunTask(null);
            handleNavigate('logs');
          }}
          onClose={() => setQuickRunTask(null)}
        />
      )}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
