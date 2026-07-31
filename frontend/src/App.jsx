import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Boxes,
  Workflow,
  Calendar,
  FileText,
  Play,
  Plus,
  Trash2,
  Edit2,
  Lock,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Upload,
  Download,
  Link,
  Settings,
  LogOut,
  Database,
  ShieldAlert
} from 'lucide-react';

// Safe UUID generator supporting insecure (non-HTTPS) contexts
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Track notified runs to avoid duplicates
  const notifiedRuns = useRef(new Set());

  // Auth state variables
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  
  // System settings state
  const [settings, setSettings] = useState({ autoCleanEnabled: false, retentionDays: 30 });

  const apiFetch = async (url, options = {}) => {
    const saved = localStorage.getItem('systemPassword');
    if (!options.headers) {
      options.headers = {};
    }
    if (saved) {
      options.headers['x-system-password'] = saved;
    }
    if (options.body && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
      localStorage.removeItem('systemPassword');
      setIsAuthenticated(false);
      throw new Error('Não autorizado');
    }
    return res;
  };

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status').then(r => r.json());
      setAuthRequired(res.required);
      if (res.required) {
        const saved = localStorage.getItem('systemPassword');
        if (!saved) {
          setIsAuthenticated(false);
        } else {
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: saved })
          });
          if (loginRes.ok) {
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('systemPassword');
            setIsAuthenticated(false);
          }
        }
      } else {
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      if (res.ok) {
        localStorage.setItem('systemPassword', passwordInput);
        setIsAuthenticated(true);
        setPasswordInput('');
        fetchData();
      } else {
        setAuthError('Senha incorreta.');
      }
    } catch (err) {
      setAuthError('Erro de conexão ao autenticar.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('systemPassword');
    setIsAuthenticated(false);
  };

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/system/settings');
      const val = await res.json();
      setSettings(val);
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await apiFetch('/api/system/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert('Configurações do sistema salvas com sucesso!');
      } else {
        alert('Falha ao salvar configurações.');
      }
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const handleExportDB = async () => {
    try {
      const res = await apiFetch('/api/system/db/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autorpa_db_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao exportar banco de dados: ' + err.message);
    }
  };

  const handleImportDB = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!window.confirm('Atenção: Isso irá substituir todas as tarefas, blocos, configurações e logs atuais do sistema. Tem certeza que deseja continuar?')) {
          return;
        }
        const res = await apiFetch('/api/system/db/import', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        if (res.ok) {
          alert('Banco de dados importado com sucesso!');
          fetchData();
        } else {
          const err = await res.json();
          alert('Erro ao importar banco de dados: ' + (err.error || 'Erro desconhecido'));
        }
      } catch (err) {
        alert('Arquivo JSON inválido: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCleanData = async (type) => {
    const msgs = {
      logs: 'Isso apagará todo o histórico de execuções, screenshots salvos e arquivos baixados. Deseja continuar?',
      screenshots: 'Deseja apagar todos os screenshots salvos na pasta do sistema?',
      downloads: 'Deseja apagar todos os arquivos baixados pelo eval na pasta do sistema?'
    };
    if (!window.confirm(msgs[type])) return;
    try {
      const res = await apiFetch(`/api/system/clean/${type}`, { method: 'POST' });
      if (res.ok) {
        const val = await res.json();
        alert(val.message);
        fetchData();
      } else {
        alert('Falha ao limpar dados.');
      }
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  // DB Data States
  const [blocks, setBlocks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editing state for Action Blocks
  const [editingBlock, setEditingBlock] = useState(null);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newParamName, setNewParamName] = useState('');
  const [newParamDesc, setNewParamDesc] = useState('');
  const [newParamDefault, setNewParamDefault] = useState('');

  // Editing state for Task Pipelines
  const [editingTask, setEditingTask] = useState(null);
  
  // Execution overrides state
  const [execTask, setExecTask] = useState(null);
  const [runOverrides, setRunOverrides] = useState({});

  const taskHasAgentControl = (taskObj) => {
    if (!taskObj.blockIds) return false;
    return taskObj.blockIds.some(bid => {
      const block = blocks.find(b => b.id === bid);
      return block && block.steps && block.steps.some(s => s.type === 'agent_control');
    });
  };

  // Editing state for Schedules
  const [newSchedule, setNewSchedule] = useState({ taskId: '', cronExpression: '', enabled: true });

  // Running task animation triggers
  const [runningTasks, setRunningTasks] = useState(new Set());

  // Modal / Detail States
  const [selectedLog, setSelectedLog] = useState(null);
  const [deepLinkLoaded, setDeepLinkLoaded] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);

  // ---------------- API Actions ----------------
  const fetchData = async () => {
    try {
      setLoading(true);
      const [resBlocks, resTasks, resSchedules, resLogs] = await Promise.all([
        apiFetch('/api/blocks').then(r => r.json()),
        apiFetch('/api/tasks').then(r => r.json()),
        apiFetch('/api/schedules').then(r => r.json()),
        apiFetch('/api/logs').then(r => r.json())
      ]);
      setBlocks(resBlocks);
      setTasks(resTasks);
      setSchedules(resSchedules);
      setLogs(resLogs);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Erro de conexão com a API do servidor ou não autenticado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchData();

    // Set up background polling for running logs/tasks every 2 seconds
    const interval = setInterval(async () => {
      try {
        const freshLogs = await apiFetch('/api/logs').then(r => r.json());
        setLogs(freshLogs);

        // Dispatch browser notifications for completed runs
        freshLogs.forEach(l => {
          if ((l.status === 'success' || l.status === 'failure') && !notifiedRuns.current.has(l.id)) {
            notifiedRuns.current.add(l.id);
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Pipeline Finalizada`, {
                body: `A pipeline "${l.taskName}" terminou com ${l.status === 'success' ? 'SUCESSO' : 'FALHA'}.`,
                icon: l.status === 'success' ? '/favicon.ico' : undefined
              });
            }
          }
        });
        
        // Update active schedules info
        const freshSchedules = await apiFetch('/api/schedules').then(r => r.json());
        setSchedules(freshSchedules);

        // Check if any log is currently "running" and sync running tasks
        const currentlyRunning = new Set();
        freshLogs.forEach(l => {
          if (l.status === 'running') {
            currentlyRunning.add(l.taskId);
          }
        });
        setRunningTasks(currentlyRunning);

        // If the open log modal is running, update its details
        if (selectedLog && selectedLog.status === 'running') {
          const updatedSelected = freshLogs.find(l => l.id === selectedLog.id);
          if (updatedSelected) setSelectedLog(updatedSelected);
        }
      } catch (e) {
        console.error('Error polling execution status:', e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isAuthenticated, selectedLog]);

  // Fetch settings on system tab activation
  useEffect(() => {
    if (activeTab === 'system' && isAuthenticated) {
      fetchSettings();
    }
  }, [activeTab, isAuthenticated]);

  // Deep link routing effect
  useEffect(() => {
    if (!loading && !deepLinkLoaded && blocks.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const id = params.get('id');

      if (tab && id) {
        if (tab === 'blocks') {
          const target = blocks.find(b => b.id === id);
          if (target) {
            setActiveTab('blocks');
            setEditingBlock(target);
            setDeepLinkLoaded(true);
          }
        } else if (tab === 'tasks') {
          const target = tasks.find(t => t.id === id);
          if (target) {
            setActiveTab('tasks');
            setEditingTask(target);
            setDeepLinkLoaded(true);
          }
        }
      }
    }
  }, [loading, blocks, tasks, deepLinkLoaded]);

  const handleExportBlock = (blockObj) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(blockObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `block-${blockObj.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportTask = (taskObj) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(taskObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `task-${taskObj.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = async (type) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (type === 'block') {
            if (!parsed.name) throw new Error('O JSON do bloco deve conter um nome.');
            parsed.steps = parsed.steps || [];
            parsed.parameters = parsed.parameters || [];
            
            const response = await apiFetch('/api/blocks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsed)
            });
            if (!response.ok) throw new Error('Falha ao salvar o bloco importado.');
            alert('Bloco importado com sucesso!');
          } else if (type === 'task') {
            if (!parsed.name) throw new Error('O JSON da pipeline deve conter um nome.');
            parsed.blocks = parsed.blocks || [];
            parsed.blockIds = parsed.blockIds || [];
            
            const response = await apiFetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsed)
            });
            if (!response.ok) throw new Error('Falha ao salvar a pipeline importada.');
            alert('Pipeline importada com sucesso!');
          }
          fetchData();
        } catch (err) {
          alert('Erro ao importar arquivo: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    fileInput.click();
  };

  const handleCopyShareLink = (tab, id) => {
    const shareUrl = `${window.location.origin}/api/${tab}/${id}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => alert('Link da representação JSON copiado para a área de transferência!'))
      .catch(() => alert('Erro ao copiar link.'));
  };

  // Handle manual task run
  const triggerTaskRun = async (taskId, overrides = {}) => {
    try {
      setRunningTasks(prev => new Set([...prev, taskId]));
      const response = await apiFetch(`/api/tasks/${taskId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameterOverrides: overrides })
      });
      if (!response.ok) {
        const errData = await response.json();
        alert(`Falha ao iniciar: ${errData.error}`);
      } else {
        const resData = await response.json();
        // Switch to logs tab to view run
        setActiveTab('logs');
        
        // Fetch logs immediately and open the modal for this execution
        try {
          const freshLogs = await apiFetch('/api/logs').then(r => r.json());
          setLogs(freshLogs);
          const newLog = freshLogs.find(l => l.id === resData.runId);
          if (newLog) {
            setSelectedLog(newLog);
          }
        } catch (e) {
          console.error('Failed to auto-open log modal:', e);
        }
      }
    } catch (err) {
      alert(`Erro de conexão: ${err.message}`);
    }
  };

  // Inspect task parameter configurations before triggering execution
  const handleStartTask = (taskObj) => {
    const taskBlocksWithParams = (taskObj.blocks || []).filter(instance => {
      const blockObj = blocks.find(b => b.id === instance.blockId);
      return blockObj && blockObj.parameters && blockObj.parameters.length > 0;
    });

    if (taskBlocksWithParams.length > 0) {
      const initialOverrides = {};
      taskBlocksWithParams.forEach(inst => {
        initialOverrides[inst.id] = { ...(inst.parameterValues || {}) };
      });
      setRunOverrides(initialOverrides);
      setExecTask(taskObj);
    } else {
      triggerTaskRun(taskObj.id);
    }
  };

  // Blocks Actions
  const handleSaveBlock = async (e) => {
    e.preventDefault();
    if (!editingBlock.name) return alert('Nome do bloco é obrigatório');

    try {
      const response = await apiFetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBlock)
      });
      if (!response.ok) throw new Error('Falha ao salvar bloco');
      
      setEditingBlock(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteBlock = async (id) => {
    if (!confirm('Deseja realmente excluir este bloco de ação?')) return;
    try {
      const response = await apiFetch(`/api/blocks/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao excluir bloco');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Tasks Actions
  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!editingTask.name) return alert('Nome da tarefa é obrigatório');
    if (editingTask.blockIds.length === 0) return alert('Selecione pelo menos um Bloco de Ação para a Pipeline');

    try {
      const response = await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTask)
      });
      if (!response.ok) throw new Error('Falha ao salvar tarefa');

      setEditingTask(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('Deseja realmente excluir esta Tarefa/Pipeline?')) return;
    try {
      const response = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao excluir tarefa');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Schedules Actions
  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!newSchedule.taskId) return alert('Selecione a tarefa alvo');
    if (!newSchedule.cronExpression) return alert('Insira a expressão Cron');

    try {
      const response = await apiFetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSchedule)
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao registrar agendamento');
      }

      setNewSchedule({ taskId: '', cronExpression: '', enabled: true });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!confirm('Excluir este agendamento?')) return;
    try {
      const response = await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao excluir agendamento');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleSchedule = async (sched) => {
    try {
      await apiFetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sched,
          enabled: !sched.enabled
        })
      });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Logs Actions
  const handleClearLogs = async () => {
    if (!confirm('Deseja limpar todos os registros e capturas de tela do histórico de execuções?')) return;
    try {
      const response = await apiFetch('/api/logs', { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao limpar logs');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // ---------------- UI Helper Builders ----------------
  const addStepToBlock = (type) => {
    const newStep = { type };
    if (type === 'navigate') newStep.url = '';
    if (type === 'click') { newStep.selector = ''; newStep.selector_type = 'id'; }
    if (type === 'type') { newStep.selector = ''; newStep.selector_type = 'id'; newStep.text = ''; }
    if (type === 'wait') { newStep.condition = 'load'; newStep.selector = ''; }
    if (type === 'press_key') newStep.key = 'Enter';
    if (type === 'list_elements') newStep.query_selector = '';
    if (type === 'conditional_if') newStep.selector_exists = '';
    if (type === 'agent_control') { newStep.acquireTimeout = 60; newStep.executionTimeout = 120; }

    setEditingBlock(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  const removeStepFromBlock = (index) => {
    setEditingBlock(prev => ({
      ...prev,
      steps: prev.steps.filter((_, idx) => idx !== index)
    }));
  };

  const moveStep = (index, direction) => {
    const steps = [...editingBlock.steps];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    
    // Swap
    const temp = steps[index];
    steps[index] = steps[targetIdx];
    steps[targetIdx] = temp;

    setEditingBlock(prev => ({ ...prev, steps }));
  };

  const updateStepField = (index, field, value) => {
    setEditingBlock(prev => {
      const updatedSteps = prev.steps.map((step, idx) => {
        if (idx === index) {
          return { ...step, [field]: value };
        }
        return step;
      });
      return { ...prev, steps: updatedSteps };
    });
  };

  const addSecretToBlock = () => {
    if (!newSecretKey || !newSecretValue) return alert('Chave e Valor da variável são obrigatórios');
    if (editingBlock.secrets && editingBlock.secrets[newSecretKey]) {
      return alert('Esta chave já foi definida neste bloco');
    }

    setEditingBlock(prev => ({
      ...prev,
      secrets: {
        ...(prev.secrets || {}),
        [newSecretKey]: newSecretValue
      }
    }));

    setNewSecretKey('');
    setNewSecretValue('');
  };

  const removeSecretFromBlock = (key) => {
    setEditingBlock(prev => {
      const copy = { ...prev.secrets };
      delete copy[key];
      return { ...prev, secrets: copy };
    });
  };

  // Task composition helpers
  const addBlockToTask = (blockId) => {
    setEditingTask(prev => {
      const currentBlocks = prev.blocks || (prev.blockIds || []).map(bid => ({
        id: generateUUID(),
        blockId: bid,
        parameterValues: {}
      }));
      const newBlockInstance = {
        id: generateUUID(),
        blockId: blockId,
        parameterValues: {}
      };
      const updatedBlocks = [...currentBlocks, newBlockInstance];
      return {
        ...prev,
        blocks: updatedBlocks,
        blockIds: updatedBlocks.map(b => b.blockId)
      };
    });
  };

  const removeBlockFromTask = (index) => {
    setEditingTask(prev => {
      const currentBlocks = prev.blocks || (prev.blockIds || []).map(bid => ({
        id: generateUUID(),
        blockId: bid,
        parameterValues: {}
      }));
      const updatedBlocks = currentBlocks.filter((_, idx) => idx !== index);
      return {
        ...prev,
        blocks: updatedBlocks,
        blockIds: updatedBlocks.map(b => b.blockId)
      };
    });
  };

  const moveBlockInTask = (index, direction) => {
    setEditingTask(prev => {
      const currentBlocks = [...(prev.blocks || (prev.blockIds || []).map(bid => ({
        id: generateUUID(),
        blockId: bid,
        parameterValues: {}
      })))];
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= currentBlocks.length) return prev;
      
      const temp = currentBlocks[index];
      currentBlocks[index] = currentBlocks[targetIdx];
      currentBlocks[targetIdx] = temp;

      return {
        ...prev,
        blocks: currentBlocks,
        blockIds: currentBlocks.map(b => b.blockId)
      };
    });
  };

  // Stats calculation
  const getStats = () => {
    const totalRuns = logs.length;
    const successCount = logs.filter(l => l.status === 'success').length;
    const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0;
    const activeScheds = schedules.filter(s => s.enabled).length;

    return { totalRuns, successRate, activeScheds, totalBlocks: blocks.length };
  };

  const stats = getStats();

  if (!isAuthenticated) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>
        <form onSubmit={handleLogin} className="card" style={{
          width: '400px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Sparkles className="text-success" size={48} style={{ marginBottom: '12px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Painel AutoRPA</h2>
            <p className="text-muted" style={{ fontSize: '13px', marginTop: '6px' }}>Autenticação necessária para acessar a orquestração</p>
          </div>

          {authError && (
            <div style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-danger)',
              borderRadius: '6px',
              color: 'var(--color-danger)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{authError}</span>
            </div>
          )}

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px' }}>Senha do Sistema</label>
            <input
              type="password"
              className="form-control"
              placeholder="Digite a senha de acesso"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              required
              autoFocus
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
            Acessar Painel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Section */}
      <aside className="sidebar">
        <div className="logo-section">
          <Sparkles className="text-success" size={28} />
          <h1>AutoRPA</h1>
        </div>

        <nav>
          <ul className="nav-links">
            <li>
              <a
                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => { setActiveTab('dashboard'); setEditingBlock(null); setEditingTask(null); }}
              >
                <LayoutDashboard size={18} />
                Dashboard
              </a>
            </li>
            <li>
              <a
                className={`nav-item ${activeTab === 'blocks' ? 'active' : ''}`}
                onClick={() => { setActiveTab('blocks'); setEditingBlock(null); setEditingTask(null); }}
              >
                <Boxes size={18} />
                Blocos de Ação
              </a>
            </li>
            <li>
              <a
                className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => { setActiveTab('tasks'); setEditingBlock(null); setEditingTask(null); }}
              >
                <Workflow size={18} />
                Tarefas (Pipelines)
              </a>
            </li>
            <li>
              <a
                className={`nav-item ${activeTab === 'scheduler' ? 'active' : ''}`}
                onClick={() => { setActiveTab('scheduler'); setEditingBlock(null); setEditingTask(null); }}
              >
                <Calendar size={18} />
                Agendador (Cron)
              </a>
            </li>
            <li>
              <a
                className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => { setActiveTab('logs'); setEditingBlock(null); setEditingTask(null); }}
              >
                <FileText size={18} />
                Logs de Execução
              </a>
            </li>
            <li>
              <a
                className={`nav-item ${activeTab === 'system' ? 'active' : ''}`}
                onClick={() => { setActiveTab('system'); setEditingBlock(null); setEditingTask(null); }}
              >
                <Settings size={18} />
                Sistema
              </a>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <p>Motor: Playwright Headless</p>
          <p style={{ marginTop: '4px' }}>v1.0.0 Stable</p>
          {authRequired && (
            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <LogOut size={14} /> Sair do Painel
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {error && (
          <div className="badge badge-danger mb-24" style={{ width: '100%', borderRadius: '8px', padding: '12px 20px' }}>
            <AlertCircle size={16} />
            <span style={{ marginLeft: '8px', textTransform: 'none' }}>{error}</span>
          </div>
        )}

        {/* ---------------- DASHBOARD TAB ---------------- */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="header-section">
              <div>
                <h2>Dashboard de Orquestração</h2>
                <p>Status atual do sistema de RPA e agentes de navegação</p>
              </div>
              <button className="btn btn-secondary" onClick={fetchData}>
                <RefreshCw size={14} /> Atualizar dados
              </button>
            </div>

            {/* Stats Summary Cards */}
            <div className="stats-grid">
              <div className="card">
                <p className="stat-title">Taxa de Sucesso</p>
                <div className="stat-value text-success">
                  {stats.successRate}%
                  <span className="stat-sub">dos runs</span>
                </div>
              </div>
              <div className="card">
                <p className="stat-title">Execuções Totais</p>
                <div className="stat-value">
                  {stats.totalRuns}
                  <span className="stat-sub">histórico</span>
                </div>
              </div>
              <div className="card">
                <p className="stat-title">Agendamentos Ativos</p>
                <div className="stat-value text-info">
                  {stats.activeScheds}
                  <span className="stat-sub">cron jobs</span>
                </div>
              </div>
              <div className="card">
                <p className="stat-title">Blocos Reutilizáveis</p>
                <div className="stat-value">
                  {stats.totalBlocks}
                  <span className="stat-sub">ações</span>
                </div>
              </div>
            </div>

            {/* Quick Run task list */}
            <div className="card mb-24">
              <h3 className="mb-24" style={{ fontSize: '18px' }}>Pipelines de Automação Rápidas</h3>
              <div className="list-wrapper">
                {tasks.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: '14px' }}>Nenhuma tarefa pipeline criada ainda. Vá em "Tarefas (Pipelines)" para criar.</p>
                ) : (
                  tasks.map(t => (
                    <div key={t.id} className="list-item" style={{ padding: '16px 24px' }}>
                      <div className="list-item-info">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {t.name}
                          {taskHasAgentControl(t) && (
                            <span className="badge badge-secondary" style={{ fontSize: '10px', padding: '2px 6px', textTransform: 'none', backgroundColor: 'rgba(155, 89, 182, 0.2)', color: '#9b59b6', border: '1px solid rgba(155, 89, 182, 0.4)' }}>
                              Controle de Agente
                            </span>
                          )}
                        </h3>
                        <p>{t.description || 'Sem descrição'}</p>
                      </div>
                      <div className="list-item-meta">
                        <span className="text-muted" style={{ fontSize: '12px' }}>{t.blockIds.length} módulos encadeados</span>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={runningTasks.has(t.id)}
                          onClick={() => handleStartTask(t)}
                        >
                          <Play size={12} fill="currentColor" /> {runningTasks.has(t.id) ? 'Executando...' : 'Iniciar'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent executions logs */}
            <div className="card">
              <h3 className="mb-24" style={{ fontSize: '18px' }}>Últimas Atividades</h3>
              {logs.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '14px' }}>Nenhum log de execução encontrado.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '12px 8px' }}>Tarefa</th>
                        <th style={{ padding: '12px 8px' }}>Início</th>
                        <th style={{ padding: '12px 8px' }}>Status</th>
                        <th style={{ padding: '12px 8px' }}>Duração</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right' }}>Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.slice(0, 5).map(l => (
                        <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500' }}>{l.taskName}</td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                            {new Date(l.startedAt).toLocaleString('pt-BR')}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span className={`badge ${l.status === 'success' ? 'badge-success' : l.status === 'failure' ? 'badge-danger' : 'badge-warning'}`}>
                              {l.status === 'success' ? 'Sucesso' : l.status === 'failure' ? 'Falha' : 'Executando'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                            {l.status === 'running' ? '...' : `${l.duration}s`}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(l)}>
                              <Eye size={12} /> Visualizar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- BLOCKS TAB ---------------- */}
        {activeTab === 'blocks' && (
          <div>
            {!editingBlock ? (
              <div>
                <div className="header-section">
                  <div>
                    <h2>Blocos de Ação</h2>
                    <p>Agrupamentos reutilizáveis de comandos de automação</p>
                  </div>
                  <div className="gap-8">
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleImportJson('block')}
                    >
                      <Upload size={16} /> Importar Bloco
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => setEditingBlock({ name: '', description: '', steps: [], secrets: {} })}
                    >
                      <Plus size={16} /> Criar Bloco
                    </button>
                  </div>
                </div>

                <div className="list-wrapper">
                  {blocks.length === 0 ? (
                    <div className="card text-center" style={{ padding: '40px', textAlign: 'center' }}>
                      <Boxes className="text-muted" size={48} style={{ margin: '0 auto 16px' }} />
                      <p className="text-muted">Você ainda não criou nenhum bloco de ação.</p>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '16px' }}
                        onClick={() => setEditingBlock({ name: '', description: '', steps: [], secrets: {} })}
                      >
                        Criar meu primeiro bloco
                      </button>
                    </div>
                  ) : (
                    blocks.map(b => (
                      <div key={b.id} className="list-item">
                        <div className="list-item-info">
                          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {b.name}
                            {b.steps.some(s => s.type === 'agent_control') && (
                              <span className="badge badge-secondary" style={{ fontSize: '10px', padding: '2px 6px', textTransform: 'none', backgroundColor: 'rgba(155, 89, 182, 0.2)', color: '#9b59b6', border: '1px solid rgba(155, 89, 182, 0.4)' }}>
                                Controle de Agente
                              </span>
                            )}
                          </h3>
                          <p>{b.description || 'Sem descrição'}</p>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <span className="badge badge-info">{b.steps.length} etapas</span>
                            {b.parameters && b.parameters.length > 0 && (
                              <span className="badge badge-info" style={{ textTransform: 'none', backgroundColor: 'rgba(52, 152, 219, 0.15)', color: 'var(--color-secondary)', border: '1px solid rgba(52, 152, 219, 0.4)' }}>
                                {b.parameters.length} parâmetros
                              </span>
                            )}
                            {b.secrets && Object.keys(b.secrets).length > 0 && (
                              <span className="badge badge-warning" style={{ textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Lock size={10} /> {Object.keys(b.secrets).length} variáveis seguras
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="list-item-meta gap-8" style={{ flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" title="Copiar Link de Compartilhamento" onClick={() => handleCopyShareLink('blocks', b.id)}>
                            <Link size={12} /> Link
                          </button>
                          <button className="btn btn-secondary btn-sm" title="Exportar Bloco como JSON" onClick={() => handleExportBlock(b)}>
                            <Download size={12} /> Exportar
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingBlock(b)}>
                            <Edit2 size={12} /> Editar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBlock(b.id)}>
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // BLOCK EDITOR
              <div>
                <div className="header-section">
                  <div>
                    <h2>{editingBlock.id ? 'Editar Bloco de Ação' : 'Novo Bloco de Ação'}</h2>
                    <p>Adicione e configure comandos ordenados de automação</p>
                  </div>
                </div>

                <form onSubmit={handleSaveBlock} className="card">
                  <div className="form-group">
                    <label>Nome do Bloco</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: Fazer Login no Painel"
                      value={editingBlock.name}
                      onChange={e => setEditingBlock({ ...editingBlock, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Descrição</label>
                    <textarea
                      className="form-control"
                      placeholder="Descreva o que este bloco realiza"
                      value={editingBlock.description}
                      onChange={e => setEditingBlock({ ...editingBlock, description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  {/* SECRETS MANAGEMENT */}
                  <div className="secrets-manager">
                    <h4 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Lock size={16} className="text-warning" /> 
                      Variáveis Privadas / Senhas (Secrets)
                    </h4>
                    <p className="text-muted" style={{ fontSize: '12px' }}>
                      Defina variáveis criptografadas com AES-256-CBC. Use o padrão <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-secondary)' }}>{"{{secret:minha_senha}}"}</code> nos inputs das ações para preenchimento seguro. Elas serão descriptografadas apenas em tempo de execução.
                    </p>

                    {/* Stored secrets list */}
                    {editingBlock.secrets && Object.keys(editingBlock.secrets).length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        {Object.entries(editingBlock.secrets).map(([key, val]) => (
                          <div key={key} className="secret-row">
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600' }}>{key}</span>
                            <span style={{ color: 'var(--text-dark)', fontSize: '13px' }}>{val}</span>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => removeSecretFromBlock(key)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new secret fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: '16px', marginTop: '16px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Chave (Ex: password)"
                        value={newSecretKey}
                        onChange={e => setNewSecretKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      />
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Valor secreto"
                        value={newSecretValue}
                        onChange={e => setNewSecretValue(e.target.value)}
                      />
                      <button type="button" className="btn btn-secondary" onClick={addSecretToBlock}>
                        Adicionar
                      </button>
                    </div>
                  </div>

                  {/* PARAMETERS MANAGEMENT */}
                  <div className="secrets-manager" style={{ borderColor: 'var(--border-color)', marginTop: '24px' }}>
                    <h4 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Boxes size={16} className="text-info" /> 
                      Parâmetros Declarados (Variáveis do Bloco)
                    </h4>
                    <p className="text-muted" style={{ fontSize: '12px' }}>
                      Defina variáveis personalizáveis para este bloco. Use o padrão <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-secondary)' }}>{"{{param:nome_do_parametro}}"}</code> nos inputs das ações abaixo.
                    </p>

                    {/* Stored parameters list */}
                    {editingBlock.parameters && editingBlock.parameters.length > 0 && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {editingBlock.parameters.map((param, pIdx) => (
                          <div key={pIdx} className="secret-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr auto', gap: '12px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600' }}>{param.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{param.description || 'Sem descrição'}</span>
                            <span style={{ color: 'var(--text-dark)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>Padrão: "{param.defaultValue}"</span>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                setEditingBlock(prev => ({
                                  ...prev,
                                  parameters: prev.parameters.filter((_, idx) => idx !== pIdx)
                                }));
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new parameter fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr auto', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Nome (Ex: url_site)"
                        value={newParamName}
                        onChange={e => setNewParamName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Descrição (Ex: URL de destino)"
                        value={newParamDesc}
                        onChange={e => setNewParamDesc(e.target.value)}
                      />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Valor padrão"
                        value={newParamDefault}
                        onChange={e => setNewParamDefault(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          if (!newParamName) return alert('O nome do parâmetro é obrigatório');
                          if (editingBlock.parameters && editingBlock.parameters.some(p => p.name === newParamName)) {
                            return alert('Este parâmetro já foi adicionado');
                          }
                          const newParam = {
                            name: newParamName,
                            description: newParamDesc,
                            defaultValue: newParamDefault
                          };
                          setEditingBlock(prev => ({
                            ...prev,
                            parameters: [...(prev.parameters || []), newParam]
                          }));
                          setNewParamName('');
                          setNewParamDesc('');
                          setNewParamDefault('');
                        }}
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>

                  {/* ACTION STEPS LIST */}
                  <div className="form-group">
                    <div className="flex-between mb-24">
                      <label style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Etapas de Automação ({editingBlock.steps.length})</label>
                      
                      {/* Add Action Steps Menu */}
                      <div className="gap-8" style={{ flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStepToBlock('navigate')}>+ Navegar</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStepToBlock('click')}>+ Clicar</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStepToBlock('type')}>+ Digitar</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStepToBlock('wait')}>+ Esperar</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStepToBlock('press_key')}>+ Tecla</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStepToBlock('extract_html')}>+ HTML</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStepToBlock('list_elements')}>+ Elementos</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStepToBlock('eval')}>+ Eval JS</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStepToBlock('take_screenshot')}>+ Print</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addStepToBlock('conditional_if')}>+ Condição Se</button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--color-secondary)' }} onClick={() => addStepToBlock('agent_control')}>+ Controle do Agente</button>
                      </div>
                    </div>

                    <div className="steps-list">
                      {editingBlock.steps.length === 0 ? (
                        <p className="text-muted" style={{ textAlign: 'center', padding: '32px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                          Adicione ações clicando nos botões acima para modelar seu bloco.
                        </p>
                      ) : (
                        editingBlock.steps.map((step, index) => (
                          <div key={index} className="step-card">
                            <div className="step-header">
                              <h4>
                                <span className="flow-step-index">{index + 1}</span>
                                <span style={{ textTransform: 'capitalize', fontWeight: '700', color: 'var(--color-primary)' }}>
                                  {step.type === 'navigate' && 'Navegar URL'}
                                  {step.type === 'click' && 'Clicar Elemento'}
                                  {step.type === 'type' && 'Digitar Input'}
                                  {step.type === 'wait' && 'Aguardar Condição'}
                                  {step.type === 'press_key' && 'Apertar Tecla'}
                                  {step.type === 'extract_html' && 'Extrair Código HTML'}
                                  {step.type === 'list_elements' && 'Listar Elementos DOM'}
                                  {step.type === 'eval' && 'Executar Javascript (Eval)'}
                                  {step.type === 'take_screenshot' && 'Tirar Screenshot'}
                                  {step.type === 'conditional_if' && 'Se Elemento Existe (Condição)'}
                                  {step.type === 'agent_control' && 'Pausar e Ceder Controle ao Agente'}
                                </span>
                              </h4>
                              <div className="gap-8">
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                                  <ArrowUp size={10} />
                                </button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveStep(index, 1)} disabled={index === editingBlock.steps.length - 1}>
                                  <ArrowDown size={10} />
                                </button>
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeStepFromBlock(index)}>
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>

                            <div className="step-body">
                              {/* Conditionally render fields based on action step type */}
                              {step.type === 'navigate' && (
                                <div style={{ gridColumn: 'span 2' }}>
                                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Endereço URL</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ex: https://wikipedia.org"
                                    value={step.url || ''}
                                    onChange={e => updateStepField(index, 'url', e.target.value)}
                                    required
                                  />
                                </div>
                              )}

                              {step.type === 'click' && (
                                <>
                                  <div>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tipo de Seletor</label>
                                    <select
                                      className="form-control"
                                      value={step.selector_type || 'id'}
                                      onChange={e => updateStepField(index, 'selector_type', e.target.value)}
                                    >
                                      <option value="id">ID</option>
                                      <option value="class">Classe CSS</option>
                                      <option value="xpath">XPath</option>
                                      <option value="text">Texto do Elemento</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Seletor / Valor</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Seletor alvo"
                                      value={step.selector || ''}
                                      onChange={e => updateStepField(index, 'selector', e.target.value)}
                                      required
                                    />
                                  </div>
                                </>
                              )}

                              {step.type === 'type' && (
                                <>
                                  <div>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Buscar Input por</label>
                                    <select
                                      className="form-control"
                                      value={step.selector_type || 'id'}
                                      onChange={e => updateStepField(index, 'selector_type', e.target.value)}
                                    >
                                      <option value="id">ID / Seletor CSS</option>
                                      <option value="label">Texto da Label</option>
                                      <option value="placeholder">Texto do Placeholder</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Seletor / Nome</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Ex: username ou #input-email"
                                      value={step.selector || ''}
                                      onChange={e => updateStepField(index, 'selector', e.target.value)}
                                      required
                                    />
                                  </div>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Texto a Digitar</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Texto a preencher (pode usar {{secret:sua_chave}})"
                                      value={step.text || ''}
                                      onChange={e => updateStepField(index, 'text', e.target.value)}
                                    />
                                  </div>
                                </>
                              )}

                              {step.type === 'wait' && (
                                <>
                                  <div>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Aguardar por</label>
                                    <select
                                      className="form-control"
                                      value={step.condition || 'load'}
                                      onChange={e => updateStepField(index, 'condition', e.target.value)}
                                    >
                                      <option value="load">Carregamento da Página (Load Event)</option>
                                      <option value="visible">Elemento Ficar Visível</option>
                                    </select>
                                  </div>
                                  {step.condition === 'visible' && (
                                    <div>
                                      <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Seletor do Elemento</label>
                                      <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Ex: .success-message ou #dashboard"
                                        value={step.selector || ''}
                                        onChange={e => updateStepField(index, 'selector', e.target.value)}
                                        required
                                      />
                                    </div>
                                  )}
                                </>
                              )}

                              {step.type === 'press_key' && (
                                <div>
                                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tecla do Teclado</label>
                                  <select
                                    className="form-control"
                                    value={step.key || 'Enter'}
                                    onChange={e => updateStepField(index, 'key', e.target.value)}
                                  >
                                    <option value="Enter">Enter</option>
                                    <option value="Tab">Tab</option>
                                    <option value="Escape">Escape</option>
                                    <option value="ArrowDown">Seta para Baixo</option>
                                    <option value="ArrowUp">Seta para Cima</option>
                                    <option value="Backspace">Backspace</option>
                                  </select>
                                </div>
                              )}

                              {step.type === 'extract_html' && (
                                <div style={{ gridColumn: 'span 2' }}>
                                  <p className="text-muted" style={{ fontSize: '12px' }}>
                                    Captura e armazena o código HTML bruto da página no histórico da execução.
                                  </p>
                                </div>
                              )}

                              {step.type === 'list_elements' && (
                                <div style={{ gridColumn: 'span 2' }}>
                                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Query Selector DOM (CSS)</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ex: table.results tr.item ou a.links-external"
                                    value={step.query_selector || ''}
                                    onChange={e => updateStepField(index, 'query_selector', e.target.value)}
                                    required
                                  />
                                </div>
                              )}

                              {step.type === 'take_screenshot' && (
                                <div style={{ gridColumn: 'span 2' }}>
                                  <p className="text-muted" style={{ fontSize: '12px' }}>
                                    Salva um instantâneo (screenshot) de página inteira nos arquivos de logs deste run.
                                  </p>
                                </div>
                              )}

                              {step.type === 'eval' && (
                                <>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Script JavaScript a Executar (retorno síncrono avaliado)</label>
                                    <textarea
                                      className="form-control"
                                      rows={4}
                                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                      placeholder="Ex: (() => { return document.title; })()"
                                      value={step.script || ''}
                                      onChange={e => updateStepField(index, 'script', e.target.value)}
                                      required
                                    />
                                  </div>
                                  <div style={{ gridColumn: 'span 2', marginTop: '12px' }}>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Salvar Saída em Arquivo (Opcional)</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Ex: participantes.csv (deixe em branco se não quiser gerar arquivo, aceita {{param:nome}})"
                                      value={step.output_file || ''}
                                      onChange={e => updateStepField(index, 'output_file', e.target.value)}
                                    />
                                  </div>
                                </>
                              )}

                              {step.type === 'conditional_if' && (
                                <div style={{ gridColumn: 'span 2' }}>
                                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Executar próxima ação APENAS SE o seletor existir:</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ex: button#accept-cookies ou div.alert-modal"
                                    value={step.selector_exists || ''}
                                    onChange={e => updateStepField(index, 'selector_exists', e.target.value)}
                                    required
                                  />
                                </div>
                              )}

                              {step.type === 'agent_control' && (
                                <>
                                  <div>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tempo Limite para Assumir (s)</label>
                                    <input
                                      type="number"
                                      className="form-control"
                                      placeholder="Ex: 60"
                                      value={step.acquireTimeout !== undefined ? step.acquireTimeout : 60}
                                      onChange={e => updateStepField(index, 'acquireTimeout', parseInt(e.target.value, 10) || 0)}
                                      required
                                      min={5}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tempo Limite de Execução (s)</label>
                                    <input
                                      type="number"
                                      className="form-control"
                                      placeholder="Ex: 120"
                                      value={step.executionTimeout !== undefined ? step.executionTimeout : 120}
                                      onChange={e => updateStepField(index, 'executionTimeout', parseInt(e.target.value, 10) || 0)}
                                      required
                                      min={5}
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="gap-8 mt-24">
                    <button type="submit" className="btn btn-primary">
                      Salvar Bloco de Ação
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingBlock(null)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ---------------- TASKS (PIPELINES) TAB ---------------- */}
        {activeTab === 'tasks' && (
          <div>
            {!editingTask ? (
              <div>
                <div className="header-section">
                  <div>
                    <h2>Pipelines de Automação (Tarefas)</h2>
                    <p>Encadeie e execute blocos lógicos estruturados</p>
                  </div>
                  <div className="gap-8">
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleImportJson('task')}
                    >
                      <Upload size={16} /> Importar Pipeline
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => setEditingTask({ name: '', description: '', blockIds: [], blocks: [] })}
                    >
                      <Plus size={16} /> Criar Pipeline
                    </button>
                  </div>
                </div>

                <div className="list-wrapper">
                  {tasks.length === 0 ? (
                    <div className="card text-center" style={{ padding: '40px', textAlign: 'center' }}>
                      <Workflow className="text-muted" size={48} style={{ margin: '0 auto 16px' }} />
                      <p className="text-muted">Nenhum pipeline/tarefa criado ainda.</p>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '16px' }}
                        onClick={() => setEditingTask({ name: '', description: '', blockIds: [], blocks: [] })}
                      >
                        Criar primeira Pipeline
                      </button>
                    </div>
                  ) : (
                    tasks.map(t => (
                      <div key={t.id} className="list-item">
                        <div className="list-item-info">
                          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {t.name}
                            {taskHasAgentControl(t) && (
                              <span className="badge badge-secondary" style={{ fontSize: '10px', padding: '2px 6px', textTransform: 'none', backgroundColor: 'rgba(155, 89, 182, 0.2)', color: '#9b59b6', border: '1px solid rgba(155, 89, 182, 0.4)' }}>
                                Controle de Agente
                              </span>
                            )}
                          </h3>
                          <p>{t.description || 'Sem descrição'}</p>
                          
                          {/* Visual sequence flow summary */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                            {t.blockIds.map((bid, bidx) => {
                              const blockObj = blocks.find(b => b.id === bid);
                              return (
                                <React.Fragment key={`${bid}-${bidx}`}>
                                  {bidx > 0 && <ChevronRight size={14} className="text-dark" />}
                                  <span className="badge badge-info" style={{ textTransform: 'none' }}>
                                    {blockObj ? blockObj.name : 'Bloco Removido'}
                                  </span>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                        <div className="list-item-meta gap-8" style={{ flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={runningTasks.has(t.id)}
                            onClick={() => handleStartTask(t)}
                          >
                            <Play size={12} fill="currentColor" /> {runningTasks.has(t.id) ? 'Rodando...' : 'Executar'}
                          </button>
                          <button className="btn btn-secondary btn-sm" title="Copiar Link de Compartilhamento" onClick={() => handleCopyShareLink('tasks', t.id)}>
                            <Link size={12} /> Link
                          </button>
                          <button className="btn btn-secondary btn-sm" title="Exportar Pipeline como JSON" onClick={() => handleExportTask(t)}>
                            <Download size={12} /> Exportar
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingTask(t)}>
                            <Edit2 size={12} /> Editar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(t.id)}>
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // TASK COMPOSER
              <div>
                <div className="header-section">
                  <div>
                    <h2>{editingTask.id ? 'Editar Pipeline de Automação' : 'Novo Pipeline de Automação'}</h2>
                    <p>Encadeie múltiplos blocos lógicos na sequência desejada de execução</p>
                  </div>
                </div>

                <form onSubmit={handleSaveTask}>
                  <div className="action-grid">
                    {/* Sidebar selectors */}
                    <div className="card">
                      <h4 className="mb-24" style={{ fontSize: '15px' }}>Blocos de Ação Disponíveis</h4>
                      {blocks.length === 0 ? (
                        <p className="text-muted" style={{ fontSize: '13px' }}>Nenhum bloco de ação criado. Você deve criar blocos de ação na aba "Blocos de Ação" primeiro.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {blocks.map(b => {
                            const count = (editingTask.blocks || []).filter(eb => eb.blockId === b.id).length;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                  textAlign: 'left',
                                  justifyContent: 'flex-start',
                                  borderColor: count > 0 ? 'var(--color-primary)' : 'var(--border-color)',
                                  backgroundColor: count > 0 ? 'var(--color-primary-glow)' : 'transparent',
                                  width: '100%',
                                  position: 'relative'
                                }}
                                onClick={() => addBlockToTask(b.id)}
                              >
                                <Plus size={14} style={{ marginRight: '8px' }} />
                                <div style={{ textAlign: 'left' }}>
                                  <div style={{ fontSize: '13px', fontWeight: '600' }}>{b.name}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{b.steps.length} etapas</div>
                                </div>
                                {count > 0 && (
                                  <span className="badge badge-info" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', margin: 0 }}>
                                    {count}x
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Visual composer canvas */}
                    <div className="pipeline-composer">
                      <div className="form-group">
                        <label>Nome da Pipeline</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Ex: Pipeline de Login e Relatório Mensal"
                          value={editingTask.name}
                          onChange={e => setEditingTask({ ...editingTask, name: e.target.value })}
                          required
                        />
                      </div>
                      
                       <div className="form-group">
                        <label>Descrição</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Finalidade deste encadeamento"
                          value={editingTask.description || ''}
                          onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                        />
                      </div>

                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
                        <input
                          type="checkbox"
                          id="antiDetectionCheckbox"
                          checked={!!editingTask.antiDetection}
                          onChange={e => setEditingTask({ ...editingTask, antiDetection: e.target.checked })}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <label htmlFor="antiDetectionCheckbox" style={{ fontSize: '13px', fontWeight: '600', cursor: 'pointer', margin: 0 }}>
                          Ativar Modo Anti-Detecção (Evita detecção de robôs / bypass bot detection)
                        </label>
                      </div>

                      <div className="form-group" style={{ marginTop: '32px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '700' }}>Fluxo de Execução Ordenado</label>
                        
                        <div className="flow-container">
                          {(!editingTask.blocks || editingTask.blocks.length === 0) ? (
                            <p className="text-muted" style={{ padding: '40px 0', fontSize: '13px', textAlign: 'center' }}>
                              Adicione blocos da lista à esquerda para compor sua pipeline.
                            </p>
                          ) : (
                            editingTask.blocks.map((instance, index) => {
                              const block = blocks.find(b => b.id === instance.blockId);
                              return (
                                <React.Fragment key={`${instance.id}-${index}`}>
                                  {index > 0 && <div className="flow-connector" />}
                                  
                                  <div className="flow-step-node" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div className="flow-step-content" style={{ flex: 1 }}>
                                        <span className="flow-step-index">{index + 1}</span>
                                        <div className="flow-step-info">
                                          <h4>{block ? block.name : 'Bloco Desconhecido'}</h4>
                                          <p>{block ? block.description || 'Sem descrição' : ''}</p>
                                        </div>
                                      </div>
                                      <div className="gap-8">
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveBlockInTask(index, -1)} disabled={index === 0}>
                                          <ArrowUp size={10} />
                                        </button>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveBlockInTask(index, 1)} disabled={index === editingTask.blocks.length - 1}>
                                          <ArrowDown size={10} />
                                        </button>
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeBlockFromTask(index)}>
                                          <Trash2 size={10} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Parameters Configuration for Block Instance */}
                                    {block && block.parameters && block.parameters.length > 0 && (
                                      <div className="flow-step-params" style={{ marginTop: '4px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                        <p style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-secondary)', marginBottom: '8px' }}>
                                          Parâmetros do Módulo:
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          {block.parameters.map((param, pIdx) => (
                                            <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center' }}>
                                              <label style={{ fontSize: '11px', margin: 0, color: 'var(--text-light)' }}>
                                                {param.name}:
                                                {param.description && <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-muted)', fontWeight: 'normal' }}>{param.description}</span>}
                                              </label>
                                              <input
                                                type="text"
                                                className="form-control"
                                                style={{ fontSize: '12px', padding: '6px 8px', height: 'auto', background: 'rgba(0,0,0,0.2)' }}
                                                placeholder={`Padrão: ${param.defaultValue}`}
                                                value={instance.parameterValues?.[param.name] || ''}
                                                onChange={e => {
                                                  const val = e.target.value;
                                                  setEditingTask(prev => {
                                                    const updatedBlocks = (prev.blocks || []).map((b, idx) => {
                                                      if (idx === index) {
                                                        return {
                                                          ...b,
                                                          parameterValues: {
                                                            ...(b.parameterValues || {}),
                                                            [param.name]: val
                                                          }
                                                        };
                                                      }
                                                      return b;
                                                    });
                                                    return {
                                                      ...prev,
                                                      blocks: updatedBlocks,
                                                      blockIds: updatedBlocks.map(b => b.blockId)
                                                    };
                                                  });
                                                }}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </React.Fragment>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="gap-8 mt-24">
                        <button type="submit" className="btn btn-primary">
                          Salvar Pipeline
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setEditingTask(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ---------------- SCHEDULER TAB ---------------- */}
        {activeTab === 'scheduler' && (
          <div>
            <div className="header-section">
              <div>
                <h2>Agendador de Tarefas</h2>
                <p>Programe suas pipelines para execução autônoma em background</p>
              </div>
            </div>

            <div className="action-grid">
              {/* Add schedule form */}
              <form onSubmit={handleAddSchedule} className="card">
                <h4 className="mb-24" style={{ fontSize: '16px' }}>Criar Novo Agendamento</h4>
                
                <div className="form-group">
                  <label>Pipeline Alvo</label>
                  <select
                    className="form-control"
                    value={newSchedule.taskId}
                    onChange={e => setNewSchedule({ ...newSchedule, taskId: e.target.value })}
                    required
                  >
                    <option value="">Selecione uma tarefa...</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Expressão Cron</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex: */5 * * * * (a cada 5min)"
                    value={newSchedule.cronExpression}
                    onChange={e => setNewSchedule({ ...newSchedule, cronExpression: e.target.value })}
                    required
                  />
                  <div style={{ marginTop: '12px' }}>
                    <p className="text-muted" style={{ fontSize: '11px' }}>Exemplos de Expressão:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      <div><span style={{ color: 'var(--color-secondary)' }}>*/15 * * * *</span> : A cada 15 minutos</div>
                      <div><span style={{ color: 'var(--color-secondary)' }}>0 * * * *</span> : De hora em hora (início)</div>
                      <div><span style={{ color: 'var(--color-secondary)' }}>0 8 * * *</span> : Todo dia às 08h00</div>
                      <div><span style={{ color: 'var(--color-secondary)' }}>0 8 * * 1</span> : Toda segunda-feira às 08h00</div>
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                  <Calendar size={14} /> Agendar Pipeline
                </button>
              </form>

              {/* Schedules table */}
              <div className="card">
                <h4 className="mb-24" style={{ fontSize: '16px' }}>Cron Jobs Ativos</h4>
                
                {schedules.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: '14px' }}>Nenhum cron job registrado ainda.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '12px 8px' }}>Pipeline</th>
                          <th style={{ padding: '12px 8px' }}>Expressão</th>
                          <th style={{ padding: '12px 8px' }}>Próximo Run</th>
                          <th style={{ padding: '12px 8px' }}>Ativo</th>
                          <th style={{ padding: '12px 8px', textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedules.map(s => {
                          const taskObj = tasks.find(t => t.id === s.taskId);
                          return (
                            <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '12px 8px', fontWeight: '600' }}>
                                {taskObj ? taskObj.name : 'Tarefa Removida'}
                              </td>
                              <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)', color: 'var(--color-secondary)' }}>
                                {s.cronExpression}
                              </td>
                              <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                                {s.enabled && s.nextRun ? new Date(s.nextRun).toLocaleString('pt-BR') : 'Inativo'}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={s.enabled}
                                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                                    onChange={() => handleToggleSchedule(s)}
                                  />
                                </label>
                              </td>
                              <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSchedule(s.id)}>
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- EXECUTION LOGS TAB ---------------- */}
        {activeTab === 'logs' && (
          <div>
            <div className="header-section">
              <div>
                <h2>Histórico de Execuções</h2>
                <p>Consulte relatórios detalhados, depure erros e verifique capturas de tela</p>
              </div>
              <div className="gap-8">
                <button className="btn btn-danger" onClick={handleClearLogs} disabled={logs.length === 0}>
                  <Trash2 size={14} /> Limpar Todos os Logs
                </button>
                <button className="btn btn-secondary" onClick={fetchData}>
                  <RefreshCw size={14} /> Recarregar
                </button>
              </div>
            </div>

            <div className="card">
              {logs.length === 0 ? (
                <p className="text-muted" style={{ padding: '40px 0', textAlign: 'center' }}>Nenhuma execução registrada no histórico do banco de dados.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '16px 8px' }}>Pipeline</th>
                        <th style={{ padding: '16px 8px' }}>Iniciado Em</th>
                        <th style={{ padding: '16px 8px' }}>Status</th>
                        <th style={{ padding: '16px 8px' }}>Duração</th>
                        <th style={{ padding: '16px 8px' }}>Detalhe do Erro</th>
                        <th style={{ padding: '16px 8px', textAlign: 'right' }}>Relatório</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(l => (
                        <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px 8px', fontWeight: '600' }}>{l.taskName}</td>
                          <td style={{ padding: '16px 8px', color: 'var(--text-muted)' }}>
                            {new Date(l.startedAt).toLocaleString('pt-BR')}
                          </td>
                          <td style={{ padding: '16px 8px' }}>
                            <span className={`badge ${l.status === 'success' ? 'badge-success' : l.status === 'failure' ? 'badge-danger' : 'badge-warning'}`}>
                              {l.status === 'success' ? 'Sucesso' : l.status === 'failure' ? 'Falha' : 'Executando'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 8px', color: 'var(--text-muted)' }}>
                            {l.status === 'running' ? '...' : `${l.duration}s`}
                          </td>
                          <td style={{ padding: '16px 8px', color: 'var(--color-danger)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {l.error || '-'}
                          </td>
                          <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(l)}>
                              <Eye size={12} /> Detalhar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- LOG DETAILS MODAL ---------------- */}
        {selectedLog && (
          <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <XCircle className="modal-close" size={24} onClick={() => setSelectedLog(null)} />
              
              <h3 className="modal-title">Detalhe da Execução: {selectedLog.taskName}</h3>
              
              <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="card" style={{ padding: '16px' }}>
                  <p className="stat-title">Status Final</p>
                  <span className={`badge ${selectedLog.status === 'success' ? 'badge-success' : selectedLog.status === 'failure' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '13px', marginTop: '4px' }}>
                    {selectedLog.status === 'success' ? 'Sucesso' : selectedLog.status === 'failure' ? 'Falha' : 'Executando'}
                  </span>
                </div>
                <div className="card" style={{ padding: '16px' }}>
                  <p className="stat-title">Duração</p>
                  <p style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px' }}>
                    {selectedLog.status === 'running' ? 'Executando...' : `${selectedLog.duration} segundos`}
                  </p>
                </div>
                <div className="card" style={{ padding: '16px', gridColumn: 'span 2' }}>
                  <p className="stat-title">Período de Execução</p>
                  <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--text-muted)' }}>
                    Início: {new Date(selectedLog.startedAt).toLocaleString('pt-BR')} <br/>
                    Fim: {selectedLog.endedAt ? new Date(selectedLog.endedAt).toLocaleString('pt-BR') : '-'}
                  </p>
                </div>
              </div>

              {selectedLog.error && (
                <div className="badge badge-danger mb-24" style={{ width: '100%', borderRadius: '8px', padding: '12px 20px', textTransform: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                    <AlertCircle size={16} /> Erro de Execução (Halter)
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{selectedLog.error}</div>
                </div>
              )}

              {/* Steps timeline trace */}
              <h4 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Histórico das Etapas Executadas</h4>
              
              <div className="log-step-timeline">
                {selectedLog.stepsExecuted && selectedLog.stepsExecuted.length > 0 ? (
                  selectedLog.stepsExecuted.map((step, idx) => (
                    <div key={idx} className="log-step-item">
                      <span className={`log-step-indicator ${step.status}`} />
                      
                      <div className="log-step-header">
                        <h4>
                          {step.blockName} &bull; Step {step.stepIndex + 1} &bull; 
                          <span style={{ textTransform: 'capitalize', color: 'var(--color-secondary)', marginLeft: '6px' }}>{step.type}</span>
                        </h4>
                        <span>
                          {step.status === 'running' 
                            ? (step.type === 'agent_control' ? 'Aguardando Agente...' : 'Rodando...') 
                            : step.status === 'skipped' ? 'Ignorado' 
                            : 'Concluído'}
                        </span>
                      </div>

                      <div className="log-step-details">
                        <div><strong>Ação:</strong> {JSON.stringify(step.params)}</div>
                        
                        {step.data && step.data.message && (
                          <div style={{ marginTop: '8px', color: 'var(--color-secondary)' }}>
                            <strong>Info:</strong> {step.data.message}
                          </div>
                        )}
                        
                        {step.data && (
                          <div style={{ marginTop: '8px', color: 'var(--color-secondary)' }}>
                            <strong>Dados Extraídos:</strong>
                            <pre style={{ overflowX: 'auto', backgroundColor: '#000', padding: '8px', borderRadius: '4px', marginTop: '4px', maxHeight: '150px' }}>
                              {JSON.stringify(step.data, null, 2)}
                            </pre>
                          </div>
                        )}

                        {step.downloadPath && (
                          <div style={{ marginTop: '12px' }}>
                            <a
                              href={step.downloadPath}
                              download={step.downloadName || 'download'}
                              className="btn btn-primary btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                textDecoration: 'none',
                                padding: '6px 12px',
                                fontSize: '12px'
                              }}
                            >
                              <Download size={12} /> Baixar Arquivo Gerado ({step.downloadName})
                            </a>
                          </div>
                        )}

                        {step.error && (
                          <div style={{ marginTop: '8px', color: 'var(--color-danger)' }}>
                            <strong>Falha:</strong> {step.error}
                          </div>
                        )}
                      </div>

                      {step.screenshotPath && (
                        <div>
                          <p className="text-muted" style={{ fontSize: '11px', marginTop: '6px' }}>Instantâneo capturado:</p>
                          <img
                            src={step.screenshotPath}
                            alt="Visual Step Preview"
                            className="log-step-screenshot"
                            onClick={() => setSelectedScreenshot(step.screenshotPath)}
                          />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted" style={{ fontSize: '13px' }}>Nenhuma etapa registrada ainda para este log.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- SYSTEM MANAGEMENT TAB ---------------- */}
        {activeTab === 'system' && (
          <div>
            <div className="header-section">
              <div>
                <h2>Gerenciamento do Sistema</h2>
                <p>Gerencie backups do banco de dados, limpeza de arquivos temporários e políticas de retenção automática</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Autoclean Settings Card */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <Clock size={20} className="text-secondary" /> Limpeza Automática de Dados
                </h3>
                <p className="text-muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
                  Configure o AutoRPA para apagar automaticamente logs antigos, imagens de screenshot e arquivos baixados para evitar consumo desnecessário de armazenamento.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.autoCleanEnabled}
                      onChange={e => setSettings(prev => ({ ...prev, autoCleanEnabled: e.target.checked }))}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span>Ativar autolimpeza recorrente (Executada diariamente)</span>
                  </label>

                  {settings.autoCleanEnabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '14px' }}>Manter logs e arquivos dos últimos</span>
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: '90px', padding: '6px 12px' }}
                        min={1}
                        value={settings.retentionDays}
                        onChange={e => setSettings(prev => ({ ...prev, retentionDays: parseInt(e.target.value, 10) || 0 }))}
                      />
                      <span style={{ fontSize: '14px' }}>dias</span>
                    </div>
                  )}

                  <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={handleSaveSettings}>
                    Salvar Configurações
                  </button>
                </div>
              </div>

              {/* Webhook Configuration Card */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <ExternalLink size={20} className="text-secondary" /> Webhooks de Execução
                </h3>
                <p className="text-muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
                  Configure endpoints HTTP POST que serão notificados em tempo real quando qualquer pipeline for iniciada e concluída.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>URL de Início da Execução</label>
                    <input
                      type="url"
                      className="form-control"
                      placeholder="Ex: https://meuhook.com/autorpa/start"
                      value={settings.startHookUrl || ''}
                      onChange={e => setSettings(prev => ({ ...prev, startHookUrl: e.target.value }))}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>URL de Fim da Execução</label>
                    <input
                      type="url"
                      className="form-control"
                      placeholder="Ex: https://meuhook.com/autorpa/end"
                      value={settings.endHookUrl || ''}
                      onChange={e => setSettings(prev => ({ ...prev, endHookUrl: e.target.value }))}
                    />
                  </div>

                  <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={handleSaveSettings}>
                    Salvar Webhooks
                  </button>
                </div>
              </div>

              {/* Database Import/Export Card */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <Database size={20} className="text-secondary" /> Backup do Banco de Dados
                </h3>
                <p className="text-muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
                  Exporte todo o conteúdo do sistema (tarefas, blocos de ações, logs e agendamentos) para um único arquivo JSON, ou importe um backup existente.
                </p>

                <div className="gap-12" style={{ flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={handleExportDB}>
                    <Download size={14} /> Exportar Banco de Dados
                  </button>
                  
                  <label className="btn btn-secondary" style={{ margin: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={14} /> Importar Banco de Dados
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportDB}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Hard Cleanups Card */}
              <div className="card" style={{ padding: '24px', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: 'var(--color-danger)' }}>
                  <ShieldAlert size={20} /> Zona de Limpeza Total
                </h3>
                <p className="text-muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
                  Limpe pastas temporárias e histórico de forma manual imediata. Atenção: estas ações são irreversíveis.
                </p>

                <div className="gap-12" style={{ flexWrap: 'wrap' }}>
                  <button className="btn btn-danger" onClick={() => handleCleanData('logs')}>
                    Limpar Todos os Logs + Arquivos
                  </button>
                  <button className="btn btn-secondary" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => handleCleanData('screenshots')}>
                    Limpar Apenas Screenshots
                  </button>
                  <button className="btn btn-secondary" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => handleCleanData('downloads')}>
                    Limpar Apenas Downloads (CSV/TXT)
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ---------------- ZOOM SCREENSHOT MODAL ---------------- */}
        {selectedScreenshot && (
          <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setSelectedScreenshot(null)}>
            <div className="modal-content" style={{ maxWidth: '95vw', padding: '16px' }} onClick={e => e.stopPropagation()}>
              <XCircle className="modal-close" size={24} onClick={() => setSelectedScreenshot(null)} />
              <img
                src={selectedScreenshot}
                alt="Visual Zoom Capture"
                style={{ width: '100%', height: 'auto', maxHeight: '80vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
              />
            </div>
          </div>
        )}

        {/* ---------------- CONFIGURAR EXECUÇÃO MODAL ---------------- */}
        {execTask && (
          <div className="modal-overlay" style={{ zIndex: 1050 }} onClick={() => setExecTask(null)}>
            <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
              <XCircle className="modal-close" size={24} onClick={() => setExecTask(null)} />
              
              <h3 className="modal-title">Configurar Execução: {execTask.name}</h3>
              <p className="text-muted mb-24" style={{ fontSize: '13px' }}>
                Revise ou insira valores temporários para os parâmetros abaixo para esta execução específica. Se deixados em branco, a execução usará os valores padrões configurados na pipeline.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px', marginBottom: '24px' }}>
                {(execTask.blocks || []).map((instance, index) => {
                  const block = blocks.find(b => b.id === instance.blockId);
                  if (!block || !block.parameters || block.parameters.length === 0) return null;

                  return (
                    <div key={instance.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '14px', color: 'var(--color-secondary)', fontWeight: '700', marginBottom: '12px' }}>
                        Etapa {index + 1}: {block.name}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {block.parameters.map((param, pIdx) => {
                          const staticValue = instance.parameterValues?.[param.name] || '';
                          const activePlaceholder = staticValue ? `Pipeline: "${staticValue}"` : `Padrão: "${param.defaultValue}"`;
                          
                          return (
                            <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '12px', alignItems: 'center' }}>
                              <label style={{ fontSize: '12px', margin: 0 }}>
                                <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{param.name}</span>
                                {param.description && <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>{param.description}</span>}
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: '12px', padding: '8px 12px' }}
                                placeholder={activePlaceholder}
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
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setExecTask(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    // Filter out empty overrides to avoid sending empty parameters
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

                    triggerTaskRun(execTask.id, cleanedOverrides);
                    setExecTask(null);
                  }}
                >
                  Confirmar e Iniciar
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
