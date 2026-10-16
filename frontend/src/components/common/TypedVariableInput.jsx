import React, { useRef } from 'react';
import { Calendar, Clock, Check, RefreshCw } from 'lucide-react';
import {
  applyBrazilianDateMask,
  convertIsoToBrazilian,
  convertBrazilianToIso,
  formatBrazilianNow,
  parseOptionsList
} from '../../utils/variableTypes';

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
  const datePickerRef = useRef(null);

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

  // 2. DATE & DATETIME (Brazilian Mask + Calendar Widget)
  if (type === 'date' || type === 'datetime') {
    const isDateTime = type === 'datetime';
    const maskPlaceholder = placeholder || (isDateTime ? 'DD/MM/AAAA HH:mm' : 'DD/MM/AAAA');
    const isoVal = convertBrazilianToIso(String(safeValue), type);

    const handleTextChange = (e) => {
      const masked = applyBrazilianDateMask(e.target.value, type);
      onChange(masked);
    };

    const handlePickerChange = (e) => {
      const iso = e.target.value;
      if (!iso) return;
      const br = convertIsoToBrazilian(iso, type);
      onChange(br);
    };

    const handleOpenPicker = () => {
      if (disabled) return;
      if (datePickerRef.current) {
        if (typeof datePickerRef.current.showPicker === 'function') {
          datePickerRef.current.showPicker();
        } else {
          datePickerRef.current.focus();
          datePickerRef.current.click();
        }
      }
    };

    const handleSetNow = () => {
      if (disabled) return;
      onChange(formatBrazilianNow(type));
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', position: 'relative' }}>
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

        {/* Hidden native picker widget */}
        <input
          ref={datePickerRef}
          type={isDateTime ? 'datetime-local' : 'date'}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            width: '1px',
            height: '1px',
            bottom: 0,
            right: '40px'
          }}
          tabIndex={-1}
          value={isoVal}
          onChange={handlePickerChange}
          disabled={disabled}
        />

        {/* Calendar / Clock Widget Button */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleOpenPicker}
          disabled={disabled}
          title={isDateTime ? 'Abrir calendário e relógio' : 'Abrir calendário'}
          style={{
            padding: size === 'sm' ? '6px 8px' : '8px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {isDateTime ? <Clock size={14} color="#a855f7" /> : <Calendar size={14} color="#3b82f6" />}
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
