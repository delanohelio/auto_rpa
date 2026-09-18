import React, { useState, useEffect } from 'react';
import {
  Clock,
  ExternalLink,
  Database,
  ShieldAlert,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';

export default function SystemView() {
  const { apiFetch } = useAuth();
  const { fetchAllCoreData } = useData();
  const toast = useToast();

  const [settings, setSettings] = useState({
    autoCleanEnabled: false,
    retentionDays: 30,
    startHookUrl: '',
    endHookUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/system/settings');
      if (res.ok) {
        const val = await res.json();
        setSettings(val);
      }
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/system/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success('Configurações Salvas', 'Políticas do sistema atualizadas.');
      } else {
        throw new Error('Falha ao salvar configurações.');
      }
    } catch (err) {
      toast.error('Erro ao Salvar', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportDB = async () => {
    try {
      const res = await apiFetch('/api/system/db/export');
      if (!res.ok) throw new Error('Falha ao exportar base');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autorpa_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup Concluído', 'Arquivo exportado com sucesso.');
    } catch (err) {
      toast.error('Erro no Backup', err.message);
    }
  };

  const handleImportDB = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm('Atenção: A importação substituirá todo o banco atual (tarefas, blocos, logs). Deseja continuar?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const res = await apiFetch('/api/system/db/import', {
          method: 'POST',
          body: JSON.stringify(parsed)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro na importação');
        }
        toast.success('Banco Restaurado', 'Todos os dados foram atualizados.');
        await fetchAllCoreData();
        await fetchSettings();
      } catch (err) {
        toast.error('Falha na Importação', err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCleanData = async (type) => {
    const labels = {
      logs: 'todos os logs e arquivos associados',
      screenshots: 'todas as capturas de tela (screenshots)',
      downloads: 'todos os arquivos gerados para download'
    };

    if (!window.confirm(`Confirma a limpeza definitiva de ${labels[type]}? Esta ação é irreversível.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/system/clean/${type}`, { method: 'POST' });
      if (!res.ok) throw new Error('Falha na limpeza');
      toast.success('Limpeza Concluída', `Operação realizada com sucesso.`);
      await fetchAllCoreData();
    } catch (err) {
      toast.error('Erro na Limpeza', err.message);
    }
  };

  return (
    <div>
      <div className="header-section">
        <div>
          <h2>Gerenciamento do Sistema</h2>
          <p>Gerencie backups do banco de dados, limpeza de arquivos temporários e políticas de retenção automática</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Autoclean Settings Card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Clock size={20} color="var(--color-secondary)" /> Limpeza Automática de Dados
          </h3>
          <p className="text-muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
            Configure o AutoRPA para apagar automaticamente logs antigos, imagens de screenshot e arquivos baixados para evitar consumo desnecessário de armazenamento.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoCleanEnabled}
                onChange={e => setSettings(prev => ({ ...prev, autoCleanEnabled: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <span>Ativar autolimpeza recorrente (Executada diariamente à meia-noite)</span>
            </label>

            {settings.autoCleanEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px' }}>Manter logs e arquivos dos últimos</span>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '90px', padding: '6px 12px' }}
                  min={1}
                  max={365}
                  value={settings.retentionDays}
                  onChange={e => setSettings(prev => ({ ...prev, retentionDays: parseInt(e.target.value, 10) || 30 }))}
                />
                <span style={{ fontSize: '14px' }}>dias</span>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={handleSaveSettings}
              disabled={isSaving}
            >
              {isSaving ? <RefreshCw className="spin" size={14} /> : <CheckCircle2 size={14} />}
              Salvar Configurações
            </button>
          </div>
        </div>

        {/* Webhooks Configuration Card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <ExternalLink size={20} color="var(--color-secondary)" /> Webhooks de Execução
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

            <button
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={handleSaveSettings}
              disabled={isSaving}
            >
              {isSaving ? <RefreshCw className="spin" size={14} /> : <CheckCircle2 size={14} />}
              Salvar Webhooks
            </button>
          </div>
        </div>

        {/* Database Import/Export Card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Database size={20} color="var(--color-secondary)" /> Backup do Banco de Dados
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
              <input type="file" accept=".json" onChange={handleImportDB} style={{ display: 'none' }} />
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
  );
}
