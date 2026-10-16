import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { encrypt } from '../utils/crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const SQLITE_FILE = path.join(DATA_DIR, 'database.sqlite');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite with WAL mode & foreign keys
const sqlite = new Database(SQLITE_FILE);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('foreign_keys = ON');

// Initialize Database Schema
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    steps TEXT NOT NULL,
    parameters TEXT NOT NULL,
    secrets TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    blocks TEXT NOT NULL,
    execution_variables TEXT,
    anti_detection INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    cron_expression TEXT DEFAULT '* * * * *',
    enabled INTEGER DEFAULT 1,
    last_run TEXT,
    next_run TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    task_name TEXT,
    trigger TEXT,
    schedule_id TEXT,
    status TEXT,
    started_at TEXT,
    ended_at TEXT,
    duration REAL,
    current_block_id TEXT,
    current_block_name TEXT,
    current_step_index INTEGER,
    error TEXT,
    steps_executed TEXT,
    screenshot_path TEXT,
    headless INTEGER,
    live_view INTEGER,
    execution_vars TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

/**
 * Normalizes any parameter or variable definition according to RPA specifications:
 * Types: 'text' (default), 'number', 'date', 'datetime', 'select', 'multiselect'.
 * Date & Datetime default to 'now'.
 * Select & Multiselect have an array of options.
 */
export function normalizeParameter(p) {
  if (!p || typeof p !== 'object') {
    return { name: '', type: 'text', defaultValue: '', description: '', options: [] };
  }
  const type = p.type || 'text';
  let defaultValue = p.defaultValue;
  if ((type === 'date' || type === 'datetime') && (defaultValue === undefined || defaultValue === null || defaultValue === '')) {
    defaultValue = 'now';
  }
  let options = [];
  if (Array.isArray(p.options)) {
    options = p.options;
  } else if (typeof p.options === 'string') {
    options = p.options.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return {
    name: p.name || '',
    type,
    defaultValue: defaultValue !== undefined ? defaultValue : '',
    description: p.description || '',
    options
  };
}

// --- Masking Helpers ---
function maskSecrets(secrets = {}) {
  const masked = {};
  for (const key of Object.keys(secrets)) {
    masked[key] = '********';
  }
  return masked;
}

// --- Automatic Migration from legacy db.json if database is freshly created ---
(function autoMigrateFromLegacyJson() {
  try {
    const blockCount = sqlite.prepare('SELECT count(*) as count FROM blocks').get().count;
    if (blockCount === 0 && fs.existsSync(LEGACY_JSON_FILE)) {
      console.log('[SQLite DB] Migrando dados do arquivo legado db.json para SQLite...');
      const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf8');
      const data = JSON.parse(raw);

      const insertBlock = sqlite.prepare(`
        INSERT OR REPLACE INTO blocks (id, name, description, category, steps, parameters, secrets, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertTask = sqlite.prepare(`
        INSERT OR REPLACE INTO tasks (id, name, description, blocks, execution_variables, anti_detection, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSchedule = sqlite.prepare(`
        INSERT OR REPLACE INTO schedules (id, task_id, cron_expression, enabled, last_run, next_run, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const insertLog = sqlite.prepare(`
        INSERT OR REPLACE INTO logs (id, task_id, task_name, trigger, schedule_id, status, started_at, ended_at, duration, current_block_id, current_block_name, current_step_index, error, steps_executed, screenshot_path, headless, live_view, execution_vars, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSetting = sqlite.prepare(`
        INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
      `);

      const migrationTx = sqlite.transaction(() => {
        // Blocks
        for (const b of data.blocks || []) {
          const params = (b.parameters || []).map(normalizeParameter);
          insertBlock.run(
            b.id || crypto.randomUUID(),
            b.name || 'Untitled Block',
            b.description || '',
            b.category || 'general',
            JSON.stringify(b.steps || []),
            JSON.stringify(params),
            JSON.stringify(b.secrets || {}),
            b.updatedAt || new Date().toISOString()
          );
        }

        // Tasks
        for (const t of data.tasks || []) {
          const execVars = (t.executionVariables || []).map(normalizeParameter);
          insertTask.run(
            t.id || crypto.randomUUID(),
            t.name || 'Untitled Task',
            t.description || '',
            JSON.stringify(t.blocks || []),
            JSON.stringify(execVars),
            t.antiDetection ? 1 : 0,
            t.updatedAt || new Date().toISOString()
          );
        }

        // Schedules
        for (const s of data.schedules || []) {
          insertSchedule.run(
            s.id || crypto.randomUUID(),
            s.taskId || '',
            s.cronExpression || '* * * * *',
            s.enabled ? 1 : 0,
            s.lastRun || null,
            s.nextRun || null,
            s.updatedAt || new Date().toISOString()
          );
        }

        // Logs
        for (const l of data.logs || []) {
          insertLog.run(
            typeof l.id === 'string' ? l.id : crypto.randomUUID(),
            typeof l.taskId === 'string' ? l.taskId : null,
            typeof l.taskName === 'string' ? l.taskName : null,
            typeof l.trigger === 'string' ? l.trigger : 'manual',
            typeof l.scheduleId === 'string' ? l.scheduleId : null,
            typeof l.status === 'string' ? l.status : 'success',
            typeof l.startedAt === 'string' ? l.startedAt : (typeof l.createdAt === 'string' ? l.createdAt : new Date().toISOString()),
            typeof l.endedAt === 'string' ? l.endedAt : null,
            typeof l.duration === 'number' ? l.duration : (l.duration !== undefined && l.duration !== null ? Number(l.duration) : null),
            typeof l.currentBlockId === 'string' ? l.currentBlockId : null,
            typeof l.currentBlockName === 'string' ? l.currentBlockName : null,
            typeof l.currentStepIndex === 'number' ? l.currentStepIndex : -1,
            typeof l.error === 'string' ? l.error : (l.error ? JSON.stringify(l.error) : null),
            JSON.stringify(l.stepsExecuted || []),
            typeof l.screenshotPath === 'string' ? l.screenshotPath : null,
            l.headless === false ? 0 : 1,
            l.liveView ? 1 : 0,
            JSON.stringify(l.executionVars || {}),
            typeof l.createdAt === 'string' ? l.createdAt : new Date().toISOString()
          );
        }

        // Settings
        if (data.settings) {
          for (const [k, v] of Object.entries(data.settings)) {
            insertSetting.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          }
        }
      });

      migrationTx();
      console.log(`[SQLite DB] Migração concluída com sucesso: ${(data.blocks || []).length} blocos, ${(data.tasks || []).length} pipelines, ${(data.schedules || []).length} agendamentos e ${(data.logs || []).length} logs.`);
      // Backup db.json
      try {
        fs.copyFileSync(LEGACY_JSON_FILE, `${LEGACY_JSON_FILE}.bak`);
      } catch (_) {}
    }
  } catch (err) {
    console.error('[SQLite DB] Erro durante a inicialização/migração SQLite:', err);
  }
})();

// --- Helper Parser Functions ---
function formatBlockRow(row, mask = true) {
  if (!row) return null;
  let steps = [];
  try { steps = JSON.parse(row.steps || '[]'); } catch (_) {}
  let parameters = [];
  try { parameters = JSON.parse(row.parameters || '[]').map(normalizeParameter); } catch (_) {}
  let secrets = {};
  try { secrets = JSON.parse(row.secrets || '{}'); } catch (_) {}

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category || 'general',
    steps,
    parameters,
    secrets: mask ? maskSecrets(secrets) : secrets,
    updatedAt: row.updated_at
  };
}

function formatTaskRow(row) {
  if (!row) return null;
  let blocks = [];
  try { blocks = JSON.parse(row.blocks || '[]'); } catch (_) {}
  let executionVariables = [];
  try { executionVariables = JSON.parse(row.execution_variables || '[]').map(normalizeParameter); } catch (_) {}

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    blocks,
    executionVariables,
    blockIds: blocks.map(b => b.blockId),
    antiDetection: Boolean(row.anti_detection),
    updatedAt: row.updated_at
  };
}

function formatScheduleRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.task_id,
    cronExpression: row.cron_expression,
    enabled: Boolean(row.enabled),
    lastRun: row.last_run || null,
    nextRun: row.next_run || null,
    updatedAt: row.updated_at
  };
}

function formatLogRow(row, includeSteps = true) {
  if (!row) return null;
  let stepsExecuted = [];
  if (includeSteps) {
    try { stepsExecuted = JSON.parse(row.steps_executed || '[]'); } catch (_) {}
  }
  let executionVars = {};
  try { executionVars = JSON.parse(row.execution_vars || '{}'); } catch (_) {}

  const result = {
    id: row.id,
    taskId: row.task_id,
    taskName: row.task_name,
    trigger: row.trigger || 'manual',
    scheduleId: row.schedule_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    duration: row.duration !== null ? Number(row.duration) : 0,
    currentBlockId: row.current_block_id,
    currentBlockName: row.current_block_name,
    currentStepIndex: row.current_step_index,
    error: row.error,
    screenshotPath: row.screenshot_path,
    headless: row.headless !== null ? Boolean(row.headless) : true,
    liveView: Boolean(row.live_view),
    executionVars,
    createdAt: row.created_at
  };

  if (includeSteps) {
    result.stepsExecuted = stepsExecuted;
  } else {
    try {
      const parsed = JSON.parse(row.steps_executed || '[]');
      result.stepsCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch (_) {
      result.stepsCount = 0;
    }
  }

  return result;
}

// Cleanup any invalid or orphaned schedules
try {
  sqlite.prepare("DELETE FROM schedules WHERE task_id IS NULL OR trim(task_id) = ''").run();
} catch (_) {}

// --- DB API Object ---
export const db = {
  rawDb: sqlite,
  // --- Blocks CRUD ---
  getBlocks(mask = true) {
    const rows = sqlite.prepare('SELECT * FROM blocks ORDER BY name ASC').all();
    return rows.map(r => formatBlockRow(r, mask));
  },

  getBlock(id, mask = true) {
    const row = sqlite.prepare('SELECT * FROM blocks WHERE id = ?').get(id);
    return formatBlockRow(row, mask);
  },

  saveBlock(blockData) {
    const existing = blockData.id ? sqlite.prepare('SELECT * FROM blocks WHERE id = ?').get(blockData.id) : null;
    const oldSecrets = existing ? JSON.parse(existing.secrets || '{}') : {};

    // Process secrets: encrypt any new secret values sent in plain text.
    // If '********', retain existing encrypted secret.
    const finalSecrets = {};
    if (blockData.secrets) {
      for (const [key, val] of Object.entries(blockData.secrets)) {
        if (val === '********') {
          if (oldSecrets[key]) {
            finalSecrets[key] = oldSecrets[key];
          }
        } else if (val) {
          finalSecrets[key] = encrypt(val);
        }
      }
    }

    const id = blockData.id || crypto.randomUUID();
    const name = blockData.name || 'Untitled Block';
    const description = blockData.description || '';
    const category = blockData.category || 'general';
    const steps = JSON.stringify(blockData.steps || []);
    const parameters = JSON.stringify((blockData.parameters || []).map(normalizeParameter));
    const secrets = JSON.stringify(finalSecrets);
    const updatedAt = new Date().toISOString();

    sqlite.prepare(`
      INSERT OR REPLACE INTO blocks (id, name, description, category, steps, parameters, secrets, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, category, steps, parameters, secrets, updatedAt);

    return formatBlockRow({
      id,
      name,
      description,
      category,
      steps,
      parameters,
      secrets,
      updated_at: updatedAt
    }, true);
  },

  deleteBlock(id) {
    const res = sqlite.prepare('DELETE FROM blocks WHERE id = ?').run(id);
    return res.changes > 0;
  },

  // --- Tasks CRUD ---
  getTasks() {
    const rows = sqlite.prepare('SELECT * FROM tasks ORDER BY name ASC').all();
    return rows.map(formatTaskRow);
  },

  getTask(id) {
    const row = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    return formatTaskRow(row);
  },

  saveTask(taskData) {
    let finalBlocks = taskData.blocks || [];
    if (taskData.blockIds && finalBlocks.length === 0) {
      finalBlocks = taskData.blockIds.map(bid => ({
        id: crypto.randomUUID(),
        blockId: bid,
        parameterValues: {}
      }));
    }

    const id = taskData.id || crypto.randomUUID();
    const name = taskData.name || 'Untitled Task';
    const description = taskData.description || '';
    const blocks = JSON.stringify(finalBlocks);
    const executionVariables = JSON.stringify((taskData.executionVariables || []).map(normalizeParameter));
    const antiDetection = taskData.antiDetection ? 1 : 0;
    const updatedAt = new Date().toISOString();

    sqlite.prepare(`
      INSERT OR REPLACE INTO tasks (id, name, description, blocks, execution_variables, anti_detection, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, blocks, executionVariables, antiDetection, updatedAt);

    return formatTaskRow({
      id,
      name,
      description,
      blocks,
      execution_variables: executionVariables,
      anti_detection: antiDetection,
      updated_at: updatedAt
    });
  },

  deleteTask(id) {
    // Delete schedules associated with task first (if not cascading)
    sqlite.prepare('DELETE FROM schedules WHERE task_id = ?').run(id);
    const res = sqlite.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return res.changes > 0;
  },

  // --- Schedules CRUD ---
  getSchedules() {
    const rows = sqlite.prepare('SELECT * FROM schedules ORDER BY updated_at DESC').all();
    return rows.map(formatScheduleRow);
  },

  getSchedule(id) {
    const row = sqlite.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    return formatScheduleRow(row);
  },

  saveSchedule(schedData) {
    const existing = schedData.id ? sqlite.prepare('SELECT * FROM schedules WHERE id = ?').get(schedData.id) : null;
    const id = schedData.id || crypto.randomUUID();
    const taskId = schedData.taskId || (existing ? existing.task_id : '');
    const cronExpression = schedData.cronExpression || (existing ? existing.cron_expression : '* * * * *');
    const enabled = schedData.enabled !== undefined ? (schedData.enabled ? 1 : 0) : (existing ? existing.enabled : 1);
    
    let lastRun = schedData.lastRun !== undefined ? schedData.lastRun : (existing ? existing.last_run : null);
    let nextRun = schedData.nextRun !== undefined ? schedData.nextRun : (existing ? existing.next_run : null);
    const updatedAt = new Date().toISOString();

    sqlite.prepare(`
      INSERT OR REPLACE INTO schedules (id, task_id, cron_expression, enabled, last_run, next_run, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, taskId, cronExpression, enabled, lastRun, nextRun, updatedAt);

    return formatScheduleRow({
      id,
      task_id: taskId,
      cron_expression: cronExpression,
      enabled,
      last_run: lastRun,
      next_run: nextRun,
      updated_at: updatedAt
    });
  },

  deleteSchedule(id) {
    const res = sqlite.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    return res.changes > 0;
  },

  // --- Logs CRUD ---
  getLogs(options = {}) {
    let whereClauses = [];
    let params = [];

    if (options.status) {
      whereClauses.push('status = ?');
      params.push(options.status);
    }
    if (options.trigger) {
      whereClauses.push('trigger = ?');
      params.push(options.trigger);
    }
    if (options.search) {
      const q = `%${options.search.toLowerCase().trim()}%`;
      whereClauses.push('(LOWER(task_name) LIKE ? OR LOWER(id) LIKE ? OR LOWER(error) LIKE ?)');
      params.push(q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const totalRow = sqlite.prepare(`SELECT count(*) as total FROM logs ${whereSql}`).get(...params);
    const total = totalRow.total;

    let orderLimitSql = 'ORDER BY started_at DESC';
    const isSummary = Boolean(options.summary);

    if (options.page || options.limit) {
      const page = Math.max(1, parseInt(options.page, 10) || 1);
      const limit = Math.max(1, parseInt(options.limit, 10) || 20);
      const totalPages = Math.ceil(total / limit) || 1;
      const offset = (page - 1) * limit;

      const rows = sqlite.prepare(`
        SELECT * FROM logs ${whereSql} ORDER BY started_at DESC LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      return {
        logs: rows.map(r => formatLogRow(r, !isSummary)),
        total,
        page,
        limit,
        totalPages
      };
    }

    const rows = sqlite.prepare(`SELECT * FROM logs ${whereSql} ORDER BY started_at DESC`).all(...params);
    return rows.map(r => formatLogRow(r, !isSummary));
  },

  getLog(id) {
    const row = sqlite.prepare('SELECT * FROM logs WHERE id = ?').get(id);
    return formatLogRow(row, true);
  },

  getStats() {
    const logs = sqlite.prepare('SELECT status, duration FROM logs').all();
    const tasksCount = sqlite.prepare('SELECT count(*) as count FROM tasks').get().count;
    const blocksCount = sqlite.prepare('SELECT count(*) as count FROM blocks').get().count;
    const schedulesActive = sqlite.prepare('SELECT count(*) as count FROM schedules WHERE enabled = 1').get().count;

    const totalRuns = logs.length;
    let successCount = 0;
    let failureCount = 0;
    let runningCount = 0;
    let totalDuration = 0;
    let durationCount = 0;

    for (const log of logs) {
      if (log.status === 'success') successCount++;
      else if (log.status === 'failure') failureCount++;
      else if (log.status === 'running') runningCount++;

      if (log.duration !== null && log.status !== 'running') {
        totalDuration += Number(log.duration) || 0;
        durationCount++;
      }
    }

    const resolvedRuns = successCount + failureCount;
    const successRate = resolvedRuns > 0 ? Math.round((successCount / resolvedRuns) * 100) : 100;
    const averageDurationSeconds = durationCount > 0 ? Math.round((totalDuration / durationCount) * 10) / 10 : 0;

    return {
      totalRuns,
      successCount,
      failureCount,
      runningCount,
      successRate,
      totalTasks: tasksCount,
      totalBlocks: blocksCount,
      activeSchedules: schedulesActive,
      averageDurationSeconds
    };
  },

  addLog(logData) {
    const id = (typeof logData.id === 'string' && logData.id.trim()) ? logData.id.trim() : crypto.randomUUID();
    const taskId = typeof logData.taskId === 'string' ? logData.taskId : null;
    const taskName = typeof logData.taskName === 'string' ? logData.taskName : null;
    const trigger = typeof logData.trigger === 'string' ? logData.trigger : 'manual';
    const scheduleId = typeof logData.scheduleId === 'string' ? logData.scheduleId : null;
    const status = typeof logData.status === 'string' ? logData.status : 'running';
    const startedAt = typeof logData.startedAt === 'string' ? logData.startedAt : (typeof logData.createdAt === 'string' ? logData.createdAt : new Date().toISOString());
    const endedAt = typeof logData.endedAt === 'string' ? logData.endedAt : null;
    const duration = typeof logData.duration === 'number' ? logData.duration : (logData.duration !== undefined && logData.duration !== null ? Number(logData.duration) : null);
    const currentBlockId = typeof logData.currentBlockId === 'string' ? logData.currentBlockId : null;
    const currentBlockName = typeof logData.currentBlockName === 'string' ? logData.currentBlockName : null;
    const currentStepIndex = typeof logData.currentStepIndex === 'number' ? logData.currentStepIndex : -1;
    const error = typeof logData.error === 'string' ? logData.error : (logData.error ? JSON.stringify(logData.error) : null);
    const stepsExecuted = JSON.stringify(logData.stepsExecuted || []);
    const screenshotPath = typeof logData.screenshotPath === 'string' ? logData.screenshotPath : null;
    const headless = logData.headless === false ? 0 : 1;
    const liveView = logData.liveView ? 1 : 0;
    const executionVars = JSON.stringify(logData.executionVars || {});
    const createdAt = typeof logData.createdAt === 'string' ? logData.createdAt : new Date().toISOString();

    sqlite.prepare(`
      INSERT OR REPLACE INTO logs (
        id, task_id, task_name, trigger, schedule_id, status, started_at, ended_at, duration,
        current_block_id, current_block_name, current_step_index, error, steps_executed,
        screenshot_path, headless, live_view, execution_vars, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, taskId, taskName, trigger, scheduleId, status, startedAt, endedAt, duration,
      currentBlockId, currentBlockName, currentStepIndex, error, stepsExecuted,
      screenshotPath, headless, liveView, executionVars, createdAt
    );

    // Limit to 200 logs
    const countRow = sqlite.prepare('SELECT count(*) as count FROM logs').get();
    if (countRow.count > 200) {
      const overflow = countRow.count - 200;
      const oldestRows = sqlite.prepare('SELECT id, screenshot_path, steps_executed FROM logs ORDER BY started_at ASC LIMIT ?').all(overflow);
      
      for (const row of oldestRows) {
        if (row.screenshot_path) {
          const fullPath = path.join(DATA_DIR, 'screenshots', path.basename(row.screenshot_path));
          try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (_) {}
        }
        try {
          const steps = JSON.parse(row.steps_executed || '[]');
          for (const s of steps) {
            if (s.screenshotPath) {
              const fullPath = path.join(DATA_DIR, 'screenshots', path.basename(s.screenshotPath));
              try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (_) {}
            }
          }
        } catch (_) {}
      }

      const idsToDelete = oldestRows.map(r => r.id);
      const deleteStmt = sqlite.prepare(`DELETE FROM logs WHERE id IN (${idsToDelete.map(() => '?').join(',')})`);
      deleteStmt.run(...idsToDelete);
    }

    return formatLogRow({
      id,
      task_id: taskId,
      task_name: taskName,
      trigger,
      schedule_id: scheduleId,
      status,
      started_at: startedAt,
      ended_at: endedAt,
      duration,
      current_block_id: currentBlockId,
      current_block_name: currentBlockName,
      current_step_index: currentStepIndex,
      error,
      steps_executed: stepsExecuted,
      screenshot_path: screenshotPath,
      headless,
      live_view: liveView,
      execution_vars: executionVars,
      created_at: createdAt
    }, true);
  },

  clearLogs() {
    const allLogs = sqlite.prepare('SELECT screenshot_path, steps_executed FROM logs').all();
    for (const row of allLogs) {
      if (row.screenshot_path) {
        const fullPath = path.join(DATA_DIR, 'screenshots', path.basename(row.screenshot_path));
        try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (_) {}
      }
      try {
        const steps = JSON.parse(row.steps_executed || '[]');
        for (const s of steps) {
          if (s.screenshotPath) {
            const fullPath = path.join(DATA_DIR, 'screenshots', path.basename(s.screenshotPath));
            try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (_) {}
          }
        }
      } catch (_) {}
    }
    sqlite.prepare('DELETE FROM logs').run();
    return true;
  },

  // --- Settings ---
  getSettings() {
    const rows = sqlite.prepare('SELECT * FROM settings').all();
    const result = { autoCleanEnabled: false, retentionDays: 30, startHookUrl: '', endHookUrl: '' };
    for (const r of rows) {
      if (r.key === 'autoCleanEnabled') result.autoCleanEnabled = r.value === 'true' || r.value === '1';
      else if (r.key === 'retentionDays') result.retentionDays = parseInt(r.value, 10) || 30;
      else if (r.key === 'startHookUrl') result.startHookUrl = r.value || '';
      else if (r.key === 'endHookUrl') result.endHookUrl = r.value || '';
    }
    return result;
  },

  saveSettings(settings) {
    const upsert = sqlite.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const tx = sqlite.transaction(() => {
      upsert.run('autoCleanEnabled', settings.autoCleanEnabled ? 'true' : 'false');
      upsert.run('retentionDays', String(parseInt(settings.retentionDays, 10) || 30));
      upsert.run('startHookUrl', settings.startHookUrl || '');
      upsert.run('endHookUrl', settings.endHookUrl || '');
    });
    tx();
    return this.getSettings();
  },

  // --- Import Entire Database ---
  importDatabase(newData) {
    if (!newData || typeof newData !== 'object') throw new Error('Dados inválidos para importação.');
    const importTx = sqlite.transaction(() => {
      sqlite.prepare('DELETE FROM logs').run();
      sqlite.prepare('DELETE FROM schedules').run();
      sqlite.prepare('DELETE FROM tasks').run();
      sqlite.prepare('DELETE FROM blocks').run();
      sqlite.prepare('DELETE FROM settings').run();

      const insertBlock = sqlite.prepare(`
        INSERT INTO blocks (id, name, description, category, steps, parameters, secrets, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const b of newData.blocks || []) {
        const params = (b.parameters || []).map(normalizeParameter);
        insertBlock.run(
          b.id || crypto.randomUUID(),
          b.name || 'Untitled Block',
          b.description || '',
          b.category || 'general',
          JSON.stringify(b.steps || []),
          JSON.stringify(params),
          JSON.stringify(b.secrets || {}),
          b.updatedAt || new Date().toISOString()
        );
      }

      const insertTask = sqlite.prepare(`
        INSERT INTO tasks (id, name, description, blocks, execution_variables, anti_detection, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of newData.tasks || []) {
        const execVars = (t.executionVariables || []).map(normalizeParameter);
        insertTask.run(
          t.id || crypto.randomUUID(),
          t.name || 'Untitled Task',
          t.description || '',
          JSON.stringify(t.blocks || []),
          JSON.stringify(execVars),
          t.antiDetection ? 1 : 0,
          t.updatedAt || new Date().toISOString()
        );
      }

      const insertSchedule = sqlite.prepare(`
        INSERT INTO schedules (id, task_id, cron_expression, enabled, last_run, next_run, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of newData.schedules || []) {
        insertSchedule.run(
          s.id || crypto.randomUUID(),
          s.taskId || '',
          s.cronExpression || '* * * * *',
          s.enabled ? 1 : 0,
          s.lastRun || null,
          s.nextRun || null,
          s.updatedAt || new Date().toISOString()
        );
      }

      const insertLog = sqlite.prepare(`
        INSERT INTO logs (id, task_id, task_name, trigger, schedule_id, status, started_at, ended_at, duration, current_block_id, current_block_name, current_step_index, error, steps_executed, screenshot_path, headless, live_view, execution_vars, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of newData.logs || []) {
        insertLog.run(
          typeof l.id === 'string' ? l.id : crypto.randomUUID(),
          typeof l.taskId === 'string' ? l.taskId : null,
          typeof l.taskName === 'string' ? l.taskName : null,
          typeof l.trigger === 'string' ? l.trigger : 'manual',
          typeof l.scheduleId === 'string' ? l.scheduleId : null,
          typeof l.status === 'string' ? l.status : 'success',
          typeof l.startedAt === 'string' ? l.startedAt : (typeof l.createdAt === 'string' ? l.createdAt : new Date().toISOString()),
          typeof l.endedAt === 'string' ? l.endedAt : null,
          typeof l.duration === 'number' ? l.duration : (l.duration !== undefined && l.duration !== null ? Number(l.duration) : null),
          typeof l.currentBlockId === 'string' ? l.currentBlockId : null,
          typeof l.currentBlockName === 'string' ? l.currentBlockName : null,
          typeof l.currentStepIndex === 'number' ? l.currentStepIndex : -1,
          typeof l.error === 'string' ? l.error : (l.error ? JSON.stringify(l.error) : null),
          JSON.stringify(l.stepsExecuted || []),
          typeof l.screenshotPath === 'string' ? l.screenshotPath : null,
          l.headless === false ? 0 : 1,
          l.liveView ? 1 : 0,
          JSON.stringify(l.executionVars || {}),
          typeof l.createdAt === 'string' ? l.createdAt : new Date().toISOString()
        );
      }

      if (newData.settings) {
        const insertSetting = sqlite.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        for (const [k, v] of Object.entries(newData.settings)) {
          insertSetting.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        }
      }
    });

    importTx();
    return true;
  },

  // --- Auto-cleanup ---
  cleanExpiredLogs() {
    const settings = this.getSettings();
    if (!settings.autoCleanEnabled) return 0;

    const retentionDays = parseInt(settings.retentionDays, 10) || 30;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - retentionDays);
    const thresholdIso = thresholdDate.toISOString();

    const expiredLogs = sqlite.prepare('SELECT id, screenshot_path, steps_executed FROM logs WHERE started_at < ?').all(thresholdIso);
    for (const log of expiredLogs) {
      if (log.screenshot_path) {
        const fullPath = path.join(DATA_DIR, 'screenshots', path.basename(log.screenshot_path));
        try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (_) {}
      }
      try {
        const steps = JSON.parse(log.steps_executed || '[]');
        for (const step of steps) {
          if (step.screenshotPath) {
            const fullPath = path.join(DATA_DIR, 'screenshots', path.basename(step.screenshotPath));
            try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (_) {}
          }
        }
      } catch (_) {}
    }

    const res = sqlite.prepare('DELETE FROM logs WHERE started_at < ?').run(thresholdIso);
    if (res.changes > 0) {
      console.log(`[SQLite DB] Auto-cleanup: deleted ${res.changes} logs older than ${retentionDays} days.`);
    }
    return res.changes;
  }
};
