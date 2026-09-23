import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { apiFetch, isAuthenticated } = useAuth();
  const toast = useToast();

  const [blocks, setBlocks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [stats, setStats] = useState({
    totalRuns: 0,
    successCount: 0,
    failureCount: 0,
    runningCount: 0,
    successRate: 100,
    totalTasks: 0,
    totalBlocks: 0,
    activeSchedules: 0,
    averageDurationSeconds: 0
  });
  const [activeRuns, setActiveRuns] = useState([]);
  const [loading, setLoading] = useState(false);

  // Keep track of previously seen runs to notify on finish
  const prevActiveRunIds = useRef(new Set());
  const isFirstActiveRunsCheck = useRef(true);
  const notifiedRunIds = useRef(new Set());

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/system/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }, [apiFetch]);

  const fetchBlocks = useCallback(async () => {
    try {
      const res = await apiFetch('/api/blocks');
      if (res.ok) {
        const data = await res.json();
        setBlocks(data);
      }
    } catch (e) {
      console.error('Failed to fetch blocks:', e);
    }
  }, [apiFetch]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await apiFetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    }
  }, [apiFetch]);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await apiFetch('/api/schedules');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (e) {
      console.error('Failed to fetch schedules:', e);
    }
  }, [apiFetch]);

  const fetchActiveRuns = useCallback(async () => {
    try {
      const res = await apiFetch('/api/runs/active');
      if (res.ok) {
        const rawRuns = await res.json();
        const runs = (Array.isArray(rawRuns) ? rawRuns : []).filter(
          r => r && typeof r.runId === 'string' && r.runId.trim().length > 0
        );
        setActiveRuns(runs);

        const currentIds = new Set(runs.map(r => r.runId));

        // Only compare against previously active runs if this is NOT the very first mount check
        if (!isFirstActiveRunsCheck.current && prevActiveRunIds.current.size > 0) {
          for (const prevId of prevActiveRunIds.current) {
            if (typeof prevId === 'string' && !currentIds.has(prevId) && !notifiedRunIds.current.has(prevId)) {
              // A run that was active has finished!
              notifiedRunIds.current.add(prevId);
              fetchStats();
              toast.info('Execução Concluída', 'Uma pipeline em andamento foi finalizada.');
            }
          }
        }

        isFirstActiveRunsCheck.current = false;
        prevActiveRunIds.current = currentIds;
      }
    } catch (e) {
      console.error('Failed to fetch active runs:', e);
    }
  }, [apiFetch, fetchStats, toast]);

  const fetchAllCoreData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchBlocks(),
        fetchTasks(),
        fetchSchedules(),
        fetchStats(),
        fetchActiveRuns()
      ]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchBlocks, fetchTasks, fetchSchedules, fetchStats, fetchActiveRuns]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllCoreData();
    }
  }, [isAuthenticated, fetchAllCoreData]);

  // Smart Polling: Poll active runs every 2s
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchActiveRuns();
    }, 2000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchActiveRuns]);

  // Mutations
  const saveBlock = async (blockData) => {
    try {
      const res = await apiFetch('/api/blocks', {
        method: 'POST',
        body: JSON.stringify(blockData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao salvar bloco');
      }
      const saved = await res.json();
      await fetchBlocks();
      await fetchStats();
      toast.success('Bloco Salvo', `Bloco "${saved.name}" salvo com sucesso.`);
      return saved;
    } catch (err) {
      toast.error('Erro ao Salvar Bloco', err.message);
      throw err;
    }
  };

  const deleteBlock = async (id) => {
    try {
      const res = await apiFetch(`/api/blocks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao excluir bloco');
      }
      await fetchBlocks();
      await fetchStats();
      toast.success('Bloco Excluído', 'O bloco de ação foi removido.');
      return true;
    } catch (err) {
      toast.error('Erro ao Excluir', err.message);
      throw err;
    }
  };

  const saveTask = async (taskData) => {
    try {
      const res = await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao salvar pipeline');
      }
      const saved = await res.json();
      await fetchTasks();
      await fetchStats();
      toast.success('Pipeline Salva', `Pipeline "${saved.name}" salva com sucesso.`);
      return saved;
    } catch (err) {
      toast.error('Erro ao Salvar Pipeline', err.message);
      throw err;
    }
  };

  const deleteTask = async (id) => {
    try {
      const res = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao excluir pipeline');
      }
      await fetchTasks();
      await fetchSchedules();
      await fetchStats();
      toast.success('Pipeline Excluída', 'A pipeline foi removida.');
      return true;
    } catch (err) {
      toast.error('Erro ao Excluir', err.message);
      throw err;
    }
  };

  const saveSchedule = async (scheduleData) => {
    try {
      const res = await apiFetch('/api/schedules', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao salvar agendamento');
      }
      const saved = await res.json();
      await fetchSchedules();
      await fetchStats();
      toast.success('Agendamento Salvo', 'Regra cron configurada com sucesso.');
      return saved;
    } catch (err) {
      toast.error('Erro no Agendamento', err.message);
      throw err;
    }
  };

  const deleteSchedule = async (id) => {
    try {
      const res = await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao excluir agendamento');
      }
      await fetchSchedules();
      await fetchStats();
      toast.success('Agendamento Removido', 'A regra cron foi desativada e excluída.');
      return true;
    } catch (err) {
      toast.error('Erro ao Excluir', err.message);
      throw err;
    }
  };

  const triggerTaskRun = async (taskId, parameterOverrides = {}, runtimeVars = {}, skipVars = [], options = {}) => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/run`, {
        method: 'POST',
        body: JSON.stringify({
          parameterOverrides,
          runtimeVars,
          skipVars,
          headless: options.headless,
          liveView: options.liveView
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao iniciar execução');
      }
      const data = await res.json();
      toast.info('Execução Iniciada', 'A pipeline está rodando em segundo plano.');
      fetchActiveRuns();
      fetchStats();
      return data;
    } catch (err) {
      toast.error('Erro ao Iniciar', err.message);
      throw err;
    }
  };

  const triggerScheduleRun = async (scheduleId, parameterOverrides = {}, runtimeVars = {}, skipVars = [], options = {}) => {
    try {
      const res = await apiFetch(`/api/schedules/${scheduleId}/run`, {
        method: 'POST',
        body: JSON.stringify({
          parameterOverrides,
          runtimeVars,
          skipVars,
          headless: options.headless,
          liveView: options.liveView
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao disparar agendamento');
      }
      const data = await res.json();
      toast.info('Agendamento Disparado', 'A rotina agendada foi iniciada imediatamente.');
      fetchActiveRuns();
      fetchStats();
      return data;
    } catch (err) {
      toast.error('Erro ao Disparar', err.message);
      throw err;
    }
  };

  return (
    <DataContext.Provider
      value={{
        blocks,
        tasks,
        schedules,
        stats,
        activeRuns,
        loading,
        fetchAllCoreData,
        fetchBlocks,
        fetchTasks,
        fetchSchedules,
        fetchStats,
        fetchActiveRuns,
        saveBlock,
        deleteBlock,
        saveTask,
        deleteTask,
        saveSchedule,
        deleteSchedule,
        triggerTaskRun,
        triggerScheduleRun
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
