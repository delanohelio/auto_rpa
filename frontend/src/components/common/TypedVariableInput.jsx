import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, Check, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  applyBrazilianDateMask,
  formatBrazilianNow,
  parseOptionsList
} from '../../utils/variableTypes';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Custom Brazilian Date & DateTime Popover Widget
 * - Sits strictly below the text input (never covers text)
 * - type='date': auto-dismisses upon picking a date
 * - type='datetime': allows picking date, hour (00-23) and minute (00-59) with explicit [OK] button
 * - Dismisses on click outside
 */
function BrazilianDatePickerPopover({ type = 'date', value, onChange, onClose }) {
  const isDateTime = type === 'datetime';

  // Parse initial state from current value or fallback to now
  const parseInitialDate = () => {
    const now = new Date();
    if (!value || typeof value !== 'string') {
      return {
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
        hour: String(now.getHours()).padStart(2, '0'),
        minute: String(now.getMinutes()).padStart(2, '0')
      };
    }

    try {
      const [datePart, timePart] = value.trim().split(' ');
      const [d, m, y] = (datePart || '').split('/').map(n => parseInt(n, 10));
      const year = y && y >= 1900 && y <= 2100 ? y : now.getFullYear();
      const month = m && m >= 1 && m <= 12 ? m - 1 : now.getMonth();
      const day = d && d >= 1 && d <= 31 ? d : now.getDate();

      let hour = String(now.getHours()).padStart(2, '0');
      let minute = String(now.getMinutes()).padStart(2, '0');
      if (timePart) {
        const [hr, mn] = timePart.split(':');
        if (hr !== undefined) hour = String(Math.min(23, Math.max(0, parseInt(hr, 10) || 0))).padStart(2, '0');
        if (mn !== undefined) minute = String(Math.min(59, Math.max(0, parseInt(mn, 10) || 0))).padStart(2, '0');
      }

      return { year, month, day, hour, minute };
    } catch (_) {
      return {
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
        hour: String(now.getHours()).padStart(2, '0'),
        minute: String(now.getMinutes()).padStart(2, '0')
      };
    }
  };

  const initial = parseInitialDate();
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [selectedDay, setSelectedDay] = useState(initial.day);
  const [selectedHour, setSelectedHour] = useState(initial.hour);
  const [selectedMinute, setSelectedMinute] = useState(initial.minute);

  // Calendar calculations
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelectDay = (day) => {
    setSelectedDay(day);

    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedYear = viewYear;

    if (!isDateTime) {
      // 1.1: Widget de data deve desaparecer ao escolher data
      const result = `${formattedDay}/${formattedMonth}/${formattedYear}`;
      onChange(result);
      onClose();
    }
  };

  // 1.2: Confirmação com botão OK para data e hora
  const handleConfirmDateTime = (e) => {
    e.stopPropagation();
    const formattedDay = String(selectedDay).padStart(2, '0');
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedYear = viewYear;
    const formattedHour = String(selectedHour).padStart(2, '0');
    const formattedMinute = String(selectedMinute).padStart(2, '0');

    const result = `${formattedDay}/${formattedMonth}/${formattedYear} ${formattedHour}:${formattedMinute}`;
    onChange(result);
    onClose();
  };

  // Quick set to now inside widget
  const handleSetNow = (e) => {
    e.stopPropagation();
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDay(now.getDate());
    const hr = String(now.getHours()).padStart(2, '0');
    const mn = String(now.getMinutes()).padStart(2, '0');
    setSelectedHour(hr);
    setSelectedMinute(mn);

    if (!isDateTime) {
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      onChange(`${d}/${m}/${now.getFullYear()}`);
      onClose();
    }
  };

  const today = new Date();
  const isCurrentMonthView = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        zIndex: 1050,
        background: '#181b24',
        border: '1px solid #2d3343',
        borderRadius: '8px',
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        padding: '12px',
        width: '280px',
        color: '#f1f5f9',
        fontSize: '12px',
        userSelect: 'none'
      }}
    >
      {/* Month & Year Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button
          type="button"
          onClick={handlePrevMonth}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid #334155',
            borderRadius: '4px',
            color: '#cbd5e1',
            cursor: 'pointer',
            padding: '4px',
            display: 'inline-flex'
          }}
          title="Mês anterior"
        >
          <ChevronLeft size={14} />
        </button>

        <span style={{ fontWeight: 600, fontSize: '13px', color: '#e2e8f0' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid #334155',
            borderRadius: '4px',
            color: '#cbd5e1',
            cursor: 'pointer',
            padding: '4px',
            display: 'inline-flex'
          }}
          title="Próximo mês"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekdays Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', marginBottom: '6px' }}>
        {WEEK_DAYS.map((wd, i) => (
          <span key={i} style={{ fontSize: '11px', color: i === 0 ? '#f87171' : '#94a3b8', fontWeight: 600, padding: '2px 0' }}>
            {wd}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '10px' }}>
        {/* Leading empty spaces */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Days of month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const isSelected = selectedDay === dayNum;
          const isToday = isCurrentMonthView && today.getDate() === dayNum;

          return (
            <button
              type="button"
              key={dayNum}
              onClick={() => handleSelectDay(dayNum)}
              style={{
                background: isSelected ? '#3b82f6' : isToday ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: isSelected ? '1px solid #60a5fa' : isToday ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                borderRadius: '4px',
                color: isSelected ? '#ffffff' : isToday ? '#93c5fd' : '#e2e8f0',
                fontWeight: isSelected || isToday ? 600 : 400,
                fontSize: '12px',
                padding: '5px 0',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.12s ease'
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.background = isToday ? 'rgba(59, 130, 246, 0.15)' : 'transparent';
              }}
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      {/* DateTime: Hours and Minutes selection */}
      {isDateTime && (
        <div style={{ borderTop: '1px solid #2d3343', paddingTop: '8px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} color="#a855f7" /> Horário:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Hour selector */}
              <select
                value={selectedHour}
                onChange={e => setSelectedHour(e.target.value)}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  borderRadius: '4px',
                  padding: '3px 4px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
              >
                {Array.from({ length: 24 }).map((_, h) => {
                  const val = String(h).padStart(2, '0');
                  return <option key={val} value={val}>{val}h</option>;
                })}
              </select>

              <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>:</span>

              {/* Minute selector */}
              <select
                value={selectedMinute}
                onChange={e => setSelectedMinute(e.target.value)}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  borderRadius: '4px',
                  padding: '3px 4px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
              >
                {Array.from({ length: 60 }).map((_, m) => {
                  const val = String(m).padStart(2, '0');
                  return <option key={val} value={val}>{val}m</option>;
                })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Footer bar: Agora button + OK button (for datetime) or close button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #2d3343', paddingTop: '8px' }}>
        <button
          type="button"
          onClick={handleSetNow}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#38bdf8',
            fontSize: '11px',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <RefreshCw size={11} /> Definir Agora
        </button>

        <div style={{ display: 'flex', gap: '6px' }}>
          {isDateTime ? (
            <button
              type="button"
              onClick={handleConfirmDateTime}
              style={{
                background: '#3b82f6',
                border: 'none',
                borderRadius: '4px',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Confirmar data e hora"
            >
              <Check size={12} strokeWidth={3} /> OK
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '4px',
                color: '#cbd5e1',
                fontSize: '11px',
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TypedVariableInput({
  type = 'text',
  value,
  onChange,
  options = [],
  placeholder = '',
  disabled = false,
  className = 'form-control',
  style = {},
  size = 'md'
}) {
  const containerRef = useRef(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Close popover when clicking outside container (Requirement 1.2)
  useEffect(() => {
    if (!isPopoverOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isPopoverOpen]);

  // Normalize current value
  const safeValue = value !== undefined && value !== null ? value : '';

  // 1. NUMBER
  if (type === 'number') {
    return (
      <input
        type="number"
        step="any"
        className={className}
        style={{ ...style, fontFamily: 'var(--font-mono)' }}
        placeholder={placeholder || 'Ex: 42 ou 3.14'}
        disabled={disabled}
        value={safeValue}
        onChange={e => {
          const val = e.target.value;
          onChange(val === '' ? '' : Number(val));
        }}
      />
    );
  }

  // 2. DATE & DATETIME (Brazilian Mask + Custom Popover Widget)
  if (type === 'date' || type === 'datetime') {
    const isDateTime = type === 'datetime';
    const maskPlaceholder = placeholder || (isDateTime ? 'DD/MM/AAAA HH:mm' : 'DD/MM/AAAA');

    const handleTextChange = (e) => {
      const masked = applyBrazilianDateMask(e.target.value, type);
      onChange(masked);
    };

    const handleTogglePopover = () => {
      if (disabled) return;
      setIsPopoverOpen(prev => !prev);
    };

    const handleSetNow = () => {
      if (disabled) return;
      onChange(formatBrazilianNow(type));
    };

    return (
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          position: 'relative'
        }}
      >
        {/* Text Input with live Brazilian mask (always visible, never covered) */}
        <input
          type="text"
          className={className}
          style={{
            ...style,
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: size === 'sm' ? '12px' : '13px'
          }}
          placeholder={maskPlaceholder}
          disabled={disabled}
          value={String(safeValue)}
          onChange={handleTextChange}
        />

        {/* Calendar / Clock Widget Button */}
        <button
          type="button"
          className={`btn ${isPopoverOpen ? 'btn-primary' : 'btn-secondary'}`}
          onClick={handleTogglePopover}
          disabled={disabled}
          title={isDateTime ? 'Abrir seletor de data e hora' : 'Abrir calendário'}
          style={{
            padding: size === 'sm' ? '6px 8px' : '8px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {isDateTime ? <Clock size={14} color={isPopoverOpen ? '#ffffff' : '#a855f7'} /> : <Calendar size={14} color={isPopoverOpen ? '#ffffff' : '#3b82f6'} />}
        </button>

        {/* Quick Set to Now button */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleSetNow}
          disabled={disabled}
          title="Definir para Agora (Data/Hora atual)"
          style={{
            padding: size === 'sm' ? '6px 8px' : '8px 10px',
            fontSize: '11px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0
          }}
        >
          <RefreshCw size={12} />
          <span style={{ fontSize: '10px' }}>Agora</span>
        </button>

        {/* Custom Popover positioned strictly below text input */}
        {isPopoverOpen && (
          <BrazilianDatePickerPopover
            type={type}
            value={String(safeValue)}
            onChange={onChange}
            onClose={() => setIsPopoverOpen(false)}
          />
        )}
      </div>
    );
  }

  // 3. SELECT (Single option)
  if (type === 'select') {
    const parsedOptions = parseOptionsList(options);
    return (
      <select
        className={className}
        style={style}
        disabled={disabled}
        value={String(safeValue)}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{placeholder || '-- Selecione uma opção --'}</option>
        {parsedOptions.map((opt, i) => (
          <option key={i} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  // 4. MULTISELECT (Multiple choice array of strings)
  if (type === 'multiselect') {
    const parsedOptions = parseOptionsList(options);
    const selectedArray = Array.isArray(safeValue)
      ? safeValue
      : (typeof safeValue === 'string' && safeValue ? safeValue.split(',').map(s => s.trim()) : []);

    const toggleOption = (opt) => {
      if (disabled) return;
      if (selectedArray.includes(opt)) {
        onChange(selectedArray.filter(item => item !== opt));
      } else {
        onChange([...selectedArray, opt]);
      }
    };

    const handleSelectAll = () => {
      if (disabled) return;
      onChange([...parsedOptions]);
    };

    const handleClearAll = () => {
      if (disabled) return;
      onChange([]);
    };

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '10px 12px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          ...style
        }}
      >
        {/* Header bar with count and quick actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {selectedArray.length} de {parsedOptions.length} selecionado{selectedArray.length !== 1 ? 's' : ''}
          </span>
          {parsedOptions.length > 0 && !disabled && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: '10px',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Todos
              </button>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>•</span>
              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '10px',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Limpar
              </button>
            </div>
          )}
        </div>

        {/* Options Chips / Checkboxes */}
        {parsedOptions.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Nenhuma opção cadastrada.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {parsedOptions.map((opt, i) => {
              const isSelected = selectedArray.includes(opt);
              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => toggleOption(opt)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                    color: isSelected ? '#93c5fd' : 'var(--text-light)',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.3)',
                      background: isSelected ? '#3b82f6' : 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 5. TEXT (Default)
  return (
    <input
      type="text"
      className={className}
      style={style}
      placeholder={placeholder || 'Digite o texto...'}
      disabled={disabled}
      value={String(safeValue)}
      onChange={e => onChange(e.target.value)}
    />
  );
}
