// Variable types utilities and formatting for Brazilian standard formats

export const VARIABLE_TYPES = [
  { value: 'text', label: 'Texto', icon: 'Type' },
  { value: 'number', label: 'Número', icon: 'Hash' },
  { value: 'date', label: 'Data (DD/MM/AAAA)', icon: 'Calendar' },
  { value: 'datetime', label: 'Data e Hora (DD/MM/AAAA HH:mm)', icon: 'Clock' },
  { value: 'select', label: 'Seletor (Opção Única)', icon: 'List' },
  { value: 'multiselect', label: 'Multi Seleção (Lista de Opções)', icon: 'ListFilter' }
];

/**
 * Returns current date/time formatted in Brazilian standard
 * Requirement 1.2 & 1.2.2: now as default, considering minutes in hours
 */
export function formatBrazilianNow(type = 'date') {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (type === 'datetime') {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  return `${day}/${month}/${year}`;
}

/**
 * Applies Brazilian input mask on text input
 * Requirement 1.2.1: mask formatting on typing
 */
export function applyBrazilianDateMask(value = '', type = 'date') {
  if (value === null || value === undefined) return '';
  const str = String(value);

  // Keep only digits
  const digits = str.replace(/\D/g, '');

  if (type === 'datetime') {
    const maxDigits = digits.slice(0, 12);
    let formatted = '';
    if (maxDigits.length > 0) formatted += maxDigits.slice(0, 2);
    if (maxDigits.length >= 3) formatted += '/' + maxDigits.slice(2, 4);
    if (maxDigits.length >= 5) formatted += '/' + maxDigits.slice(4, 8);
    if (maxDigits.length >= 9) formatted += ' ' + maxDigits.slice(8, 10);
    if (maxDigits.length >= 11) formatted += ':' + maxDigits.slice(10, 12);
    return formatted;
  }

  // Single date DD/MM/YYYY
  const maxDigits = digits.slice(0, 8);
  let formatted = '';
  if (maxDigits.length > 0) formatted += maxDigits.slice(0, 2);
  if (maxDigits.length >= 3) formatted += '/' + maxDigits.slice(2, 4);
  if (maxDigits.length >= 5) formatted += '/' + maxDigits.slice(4, 8);
  return formatted;
}

/**
 * Parses options from array or textarea newline-separated string
 * Requirement 1.3: options separated by line breaks
 */
export function parseOptionsList(options) {
  if (Array.isArray(options)) {
    return options.map(opt => String(opt).trim()).filter(Boolean);
  }
  if (typeof options === 'string') {
    return options
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
  return [];
}

/**
 * Formats options list into newline-separated string for textarea editing
 */
export function formatOptionsToText(options) {
  if (Array.isArray(options)) {
    return options.join('\n');
  }
  if (typeof options === 'string') {
    return options;
  }
  return '';
}

/**
 * Converts native date picker ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm) to Brazilian format
 */
export function convertIsoToBrazilian(isoStr = '', type = 'date') {
  if (!isoStr) return '';
  try {
    const [datePart, timePart] = isoStr.split('T');
    const [year, month, day] = (datePart || '').split('-');
    if (!year || !month || !day) return isoStr;

    const brDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    if (type === 'datetime' && timePart) {
      const [hh, mm] = timePart.split(':');
      return `${brDate} ${(hh || '00').padStart(2, '0')}:${(mm || '00').padStart(2, '0')}`;
    }
    return brDate;
  } catch (_) {
    return isoStr;
  }
}

/**
 * Converts Brazilian date format (DD/MM/YYYY or DD/MM/YYYY HH:mm) to ISO for native picker value
 */
export function convertBrazilianToIso(brStr = '', type = 'date') {
  if (!brStr || typeof brStr !== 'string') return '';
  try {
    const parts = brStr.trim().split(' ');
    const datePart = parts[0];
    const timePart = parts[1];

    const [day, month, year] = (datePart || '').split('/');
    if (!day || !month || !year || year.length < 4) return '';

    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    if (type === 'datetime') {
      const [hh, mm] = (timePart || '00:00').split(':');
      return `${isoDate}T${(hh || '00').padStart(2, '0')}:${(mm || '00').padStart(2, '0')}`;
    }
    return isoDate;
  } catch (_) {
    return '';
  }
}

/**
 * Returns typed default value
 */
export function getDefaultValueForType(type = 'text', options = []) {
  if (type === 'date' || type === 'datetime') {
    return formatBrazilianNow(type);
  }
  if (type === 'number') {
    return 0;
  }
  if (type === 'select') {
    const parsed = parseOptionsList(options);
    return parsed.length > 0 ? parsed[0] : '';
  }
  if (type === 'multiselect') {
    return [];
  }
  return '';
}

/**
 * Casts a variable value to its strict primitive type for execution
 * Requirement 1.3.1, 1.3.2, 1.4.1
 */
export function castVariableValue(val, type = 'text') {
  if (type === 'number') {
    if (val === '' || val === null || val === undefined) return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  }
  if (type === 'multiselect') {
    if (Array.isArray(val)) return val.map(x => String(x).trim()).filter(Boolean);
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.map(x => String(x).trim()).filter(Boolean);
      } catch (_) {}
      return val.split(',').map(x => x.trim()).filter(Boolean);
    }
    return [];
  }
  if (type === 'date' || type === 'datetime') {
    if (!val || val === 'now') return formatBrazilianNow(type);
    return String(val);
  }
  return val === null || val === undefined ? '' : String(val);
}
