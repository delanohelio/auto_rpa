import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  Boxes,
  Workflow,
  Calendar,
  FileText,
  Settings,
  Play,
  ArrowRight,
  Database,
  Trash2
} from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function CommandPalette({ isOpen, onClose, onNavigate, onTriggerTask }) {
  const { blocks, tasks } = useData();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build searchable items list
  const items = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    const result = [];

    // Navigation sections
    const navItems = [
      { id: 'nav_dashboard', title: 'Ir para Dashboard', group: 'Navegação', icon: LayoutDashboard, action: () => onNavigate('dashboard') },
      { id: 'nav_blocks', title: 'Ir para Blocos de Ação', group: 'Navegação', icon: Boxes, action: () => onNavigate('blocks') },
      { id: 'nav_tasks', title: 'Ir para Pipelines (Tarefas)', group: 'Navegação', icon: Workflow, action: () => onNavigate('tasks') },
      { id: 'nav_scheduler', title: 'Ir para Agendamentos Cron', group: 'Navegação', icon: Calendar, action: () => onNavigate('scheduler') },
      { id: 'nav_logs', title: 'Ir para Histórico de Execuções', group: 'Navegação', icon: FileText, action: () => onNavigate('logs') },
      { id: 'nav_system', title: 'Ir para Configurações do Sistema', group: 'Navegação', icon: Settings, action: () => onNavigate('system') }
    ];

    navItems.forEach(item => {
      if (!q || item.title.toLowerCase().includes(q)) {
        result.push(item);
      }
    });

    // Pipelines / Tasks
    tasks.forEach(task => {
      if (!q || task.name.toLowerCase().includes(q) || (task.description && task.description.toLowerCase().includes(q))) {
        result.push({
          id: `task_${task.id}`,
          title: `Pipeline: ${task.name}`,
          sub: task.description || `${task.blocks?.length || 0} blocos`,
          group: 'Pipelines',
          icon: Workflow,
          action: () => onNavigate('tasks', task.id)
        });
        result.push({
          id: `task_run_${task.id}`,
          title: `Executar: ${task.name}`,
          sub: 'Disparar execução agora',
          group: 'Ações Rápidas',
          icon: Play,
          action: () => onTriggerTask(task)
        });
      }
    });

    // Blocks
    blocks.forEach(block => {
      if (!q || block.name.toLowerCase().includes(q) || (block.description && block.description.toLowerCase().includes(q))) {
        result.push({
          id: `block_${block.id}`,
          title: `Bloco: ${block.name}`,
          sub: `${block.steps?.length || 0} etapas`,
          group: 'Blocos de Ação',
          icon: Boxes,
          action: () => onNavigate('blocks', block.id)
        });
      }
    });

    return result.slice(0, 25);
  }, [query, tasks, blocks, onNavigate, onTriggerTask]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (items.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % (items.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette-modal" onClick={e => e.stopPropagation()}>
        <div className="command-search-header">
          <Search size={18} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            className="command-search-input"
            placeholder="O que você deseja fazer? Busque telas, pipelines, blocos ou execute ações..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <span className="kbd-shortcut">ESC para fechar</span>
        </div>

        <div className="command-results-list">
          {items.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
              Nenhum comando ou resultado encontrado para "{query}".
            </div>
          ) : (
            items.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`command-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="command-item-left">
                    <Icon size={16} color={isSelected ? 'var(--color-primary)' : 'var(--text-muted)'} />
                    <div>
                      <div className="command-item-title">{item.title}</div>
                      {item.sub && <div className="command-item-sub">{item.sub}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-dark)', textTransform: 'uppercase' }}>{item.group}</span>
                    {isSelected && <ArrowRight size={14} color="var(--color-primary)" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <div style={{ display: 'flex', gap: '12px' }}>
            <span><strong style={{ color: 'var(--text-muted)' }}>↑↓</strong> Navegar</span>
            <span><strong style={{ color: 'var(--text-muted)' }}>↵</strong> Executar</span>
          </div>
          <span>AutoRPA 2.0 Command Bus</span>
        </div>
      </div>
    </div>
  );
}
