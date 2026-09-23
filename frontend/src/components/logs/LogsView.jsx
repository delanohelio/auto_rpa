import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Trash2,
  RefreshCw,
  Search,
  Eye,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Square
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import LogDetailsModal from './LogDetailsModal';

export default function LogsView({ initialLogId, onClearInitialLogId }) {
  const { apiFetch } = useAuth();
  const { activeRuns, fetchStats } = useData();
  const toast = useToast();

  const [logsData, setLogsData] = useState({ logs: [], total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState(initialLogId || null);

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [triggerFilter, setTriggerFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    if (initialLogId) {
      setSelectedLogId(initialLogId);
      onClearInitialLogId?.();
    }
  }, [initialLogId, onClearInitialLogId]);

  const fetchLogs = useCallback(async (page = currentPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      params.set('summary', 'true');
      if (statusFilter) params.set('status', statusFilter);
      if (triggerFilter) params.set('trigger', triggerFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiFetch(`/api/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        // Handle array fallback or paginated object
        if (Array.isArray(data)) {
          setLogsData({ logs: data, total: data.length, page: 1, limit: 15, totalPages: 1 });
        } else {
          setLogsData(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, currentPage, statusFilter, triggerFilter, search]);

  useEffect(() => {
    fetchLogs(currentPage);
  }, [fetchLogs, currentPage]);

  // Re-fetch when active runs change
  useEffect(() => {
    if (activeRuns.length > 0) {
      const timer = setInterval(() => {
        fetchLogs(currentPage);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [activeRuns.length, fetchLogs, currentPage]);

  const handleClearLogs = async () => {
    if (!window.confirm('Tem certeza que deseja apagar todo o histórico de execuções e capturas de tela? Esta ação é irreversível.')) {
      return;
    }
    try {
      const res = await apiFetch('/api/logs', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Logs Limpos', 'O histórico de execuções foi esvaziado.');
        await fetchLogs(1);
        await fetchStats();
      }
    } catch (err) {
      toast.error('Erro ao Limpar', err.message);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= logsData.totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div>
      <div className="header-section">
        <div>
          <h2>Histórico de Execuções</h2>
          <p>Consulte relatórios detalhados, depure erros e verifique capturas de tela</p>
        </div>

        <div className="gap-8">
          <button
            className="btn btn-danger btn-sm"
            onClick={handleClearLogs}
            disabled={logsData.total === 0}
          >
            <Trash2 size={14} /> Limpar Todos os Logs
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchLogs(currentPage)}
            disabled={loading}
          >
            <RefreshCw className={loading ? 'spin' : ''} size={14} /> Recarregar
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-search-bar">
        <div className="search-input-wrapper">
          <Search className="search-input-icon" size={16} />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por pipeline, ID ou mensagem de erro..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            className="form-control"
            style={{ width: '150px' }}
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Status: Todos</option>
            <option value="success">Sucesso</option>
            <option value="failure">Falha</option>
            <option value="running">Executando</option>
          </select>

          <select
            className="form-control"
            style={{ width: '160px' }}
            value={triggerFilter}
            onChange={e => {
              setTriggerFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Origem: Todas</option>
            <option value="manual">Manual</option>
            <option value="schedule">Agendado (Cron)</option>
          </select>
        </div>
      </div>

      {/* Logs Table Card */}
      <div className="card">
        {logsData.logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <FileText size={36} color="var(--text-dark)" style={{ margin: '0 auto 12px' }} />
            <p className="text-muted">
              {search || statusFilter || triggerFilter
                ? 'Nenhum log encontrado para os filtros aplicados.'
                : 'Nenhuma execução registrada no histórico.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '14px 10px' }}>Pipeline</th>
                  <th style={{ padding: '14px 10px' }}>Iniciado Em</th>
                  <th style={{ padding: '14px 10px' }}>Status</th>
                  <th style={{ padding: '14px 10px' }}>Duração</th>
                  <th style={{ padding: '14px 10px' }}>Detalhe do Erro</th>
                  <th style={{ padding: '14px 10px', textAlign: 'right' }}>Relatório</th>
                </tr>
              </thead>
              <tbody>
                {logsData.logs.map(log => (
                  <tr
                    key={log.id}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    onClick={() => setSelectedLogId(log.id)}
                  >
                    <td style={{ padding: '14px 10px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{log.taskName}</span>
                        {log.trigger === 'schedule' ? (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#60a5fa',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              fontSize: '10px',
                              padding: '2px 6px'
                            }}
                          >
                            <Clock size={10} /> Agendado
                          </span>
                        ) : (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-color)',
                              fontSize: '10px',
                              padding: '2px 6px'
                            }}
                          >
                            <Play size={10} /> Manual
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '14px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {new Date(log.startedAt).toLocaleString('pt-BR')}
                    </td>

                    <td style={{ padding: '14px 10px' }}>
                      <span className={`badge ${
                        log.status === 'success' ? 'badge-success' :
                        log.status === 'failure' ? 'badge-danger' :
                        log.status === 'cancelled' ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {log.status === 'success' ? 'Sucesso' :
                         log.status === 'failure' ? 'Falha' :
                         log.status === 'cancelled' ? 'Cancelado' : 'Executando'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {log.status === 'running' ? '...' : `${log.duration}s`}
                    </td>

                    <td style={{ padding: '14px 10px', color: 'var(--color-danger)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px' }}>
                      {log.error || '-'}
                    </td>

                    <td style={{ padding: '14px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {log.status === 'running' && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              padding: '4px 8px',
                              fontSize: '11px',
                              gap: '4px'
                            }}
                            title="Parar execução imediatamente"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.confirm(`Deseja interromper a execução de "${log.taskName}"?`)) return;
                              try {
                                const res = await apiFetch(`/api/runs/${log.id}/stop`, { method: 'POST' });
                                if (res.ok) {
                                  toast.success('Execução Cancelada', 'A execução foi interrompida.');
                                  fetchLogs(currentPage);
                                } else {
                                  const err = await res.json().catch(() => ({}));
                                  throw new Error(err.error || 'Erro ao parar');
                                }
                              } catch (err) {
                                toast.error('Erro ao parar', err.message);
                              }
                            }}
                          >
                            <Square size={11} style={{ fill: 'currentColor' }} /> Parar
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogId(log.id);
                          }}
                        >
                          <Eye size={12} /> Detalhar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {logsData.totalPages > 1 && (
              <div className="pagination-container">
                <div>
                  Exibindo página <strong>{logsData.page}</strong> de <strong>{logsData.totalPages}</strong> ({logsData.total} registros)
                </div>

                <div className="pagination-controls">
                  <button
                    className="page-btn"
                    disabled={logsData.page <= 1}
                    onClick={() => handlePageChange(logsData.page - 1)}
                  >
                    Anterior
                  </button>

                  {Array.from({ length: Math.min(logsData.totalPages, 5) }).map((_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        className={`page-btn ${logsData.page === p ? 'active' : ''}`}
                        onClick={() => handlePageChange(p)}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    className="page-btn"
                    disabled={logsData.page >= logsData.totalPages}
                    onClick={() => handlePageChange(logsData.page + 1)}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLogId && (
        <LogDetailsModal
          logId={selectedLogId}
          onClose={() => setSelectedLogId(null)}
          onRefreshList={() => fetchLogs(currentPage)}
        />
      )}
    </div>
  );
}
