import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encrypt } from '../utils/crypto.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure database file exists with initial structure
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    blocks: [],
    tasks: [],
    schedules: [],
    logs: []
  }, null, 2), 'utf8');
}

/**
 * Reads the database file.
 * Uses a try-catch fallback.
 */
function readDB() {
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading DB file, returning empty state:', error);
    return { blocks: [], tasks: [], schedules: [], logs: [] };
  }
}

/**
 * Writes the database file atomically to prevent corruption.
 */
function writeDB(data) {
  const tempFile = `${DB_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('Atomic DB write failed:', error);
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (_) {}
    }
    throw error;
  }
}

// --- Masking Helpers ---
function maskSecrets(secrets = {}) {
  const masked = {};
  for (const key of Object.keys(secrets)) {
    masked[key] = '********';
  }
  return masked;
}

// --- Blocks CRUD ---
export const db = {
  // Blocks
  getBlocks(mask = true) {
    const data = readDB();
    if (!mask) return data.blocks;
    return data.blocks.map(b => ({
      ...b,
      secrets: maskSecrets(b.secrets)
    }));
  },

  getBlock(id, mask = true) {
    const data = readDB();
    const block = data.blocks.find(b => b.id === id);
    if (!block) return null;
    if (!mask) return block;
    return {
      ...block,
      secrets: maskSecrets(block.secrets)
    };
  },

  saveBlock(blockData) {
    const data = readDB();
    const existingIndex = data.blocks.findIndex(b => b.id === blockData.id);
    
    // Process secrets: encrypt any new secret values sent in plain text.
    // If the value is '********' (masked), it means the user did not modify it, so preserve the old encrypted value.
    const finalSecrets = {};
    const oldBlock = existingIndex >= 0 ? data.blocks[existingIndex] : null;

    if (blockData.secrets) {
      for (const [key, val] of Object.entries(blockData.secrets)) {
        if (val === '********') {
          // Keep existing encrypted value
          finalSecrets[key] = oldBlock?.secrets?.[key] || '';
        } else if (val) {
          // Encrypt new value
          finalSecrets[key] = encrypt(val);
        }
      }
    }

    const blockToSave = {
      id: blockData.id || crypto.randomUUID(),
      name: blockData.name || 'Untitled Block',
      description: blockData.description || '',
      steps: blockData.steps || [],
      secrets: finalSecrets,
      parameters: blockData.parameters || [],
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      data.blocks[existingIndex] = blockToSave;
    } else {
      data.blocks.push(blockToSave);
    }

    writeDB(data);
    return this.getBlock(blockToSave.id);
  },

  deleteBlock(id) {
    const data = readDB();
    const originalLength = data.blocks.length;
    data.blocks = data.blocks.filter(b => b.id !== id);
    if (data.blocks.length !== originalLength) {
      writeDB(data);
      return true;
    }
    return false;
  },

  // Tasks (Pipelines)
  getTasks() {
    const data = readDB();
    return data.tasks.map(t => {
      const blocks = t.blocks || (t.blockIds || []).map(bid => ({
        id: crypto.randomUUID(),
        blockId: bid,
        parameterValues: {}
      }));
      return {
        ...t,
        blocks,
        blockIds: blocks.map(b => b.blockId)
      };
    });
  },

  getTask(id) {
    const data = readDB();
    const t = data.tasks.find(task => task.id === id);
    if (!t) return null;
    const blocks = t.blocks || (t.blockIds || []).map(bid => ({
      id: crypto.randomUUID(),
      blockId: bid,
      parameterValues: {}
    }));
    return {
      ...t,
      blocks,
      blockIds: blocks.map(b => b.blockId)
    };
  },

  saveTask(taskData) {
    const data = readDB();
    const existingIndex = data.tasks.findIndex(t => t.id === taskData.id);

    let finalBlocks = taskData.blocks || [];
    if (taskData.blockIds && finalBlocks.length === 0) {
      finalBlocks = taskData.blockIds.map(bid => ({
        id: crypto.randomUUID(),
        blockId: bid,
        parameterValues: {}
      }));
    }

    const taskToSave = {
      id: taskData.id || crypto.randomUUID(),
      name: taskData.name || 'Untitled Task',
      description: taskData.description || '',
      blocks: finalBlocks,
      antiDetection: !!taskData.antiDetection,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      data.tasks[existingIndex] = taskToSave;
    } else {
      data.tasks.push(taskToSave);
    }

    writeDB(data);
    return {
      ...taskToSave,
      blockIds: taskToSave.blocks.map(b => b.blockId)
    };
  },

  deleteTask(id) {
    const data = readDB();
    const originalLength = data.tasks.length;
    data.tasks = data.tasks.filter(t => t.id !== id);
    // Also remove schedules associated with this task
    data.schedules = data.schedules.filter(s => s.taskId !== id);
    
    if (data.tasks.length !== originalLength) {
      writeDB(data);
      return true;
    }
    return false;
  },

  // Schedules
  getSchedules() {
    const data = readDB();
    return data.schedules;
  },

  getSchedule(id) {
    const data = readDB();
    return data.schedules.find(s => s.id === id) || null;
  },

  saveSchedule(schedData) {
    const data = readDB();
    const existingIndex = data.schedules.findIndex(s => s.id === schedData.id);

    let schedToSave;
    if (existingIndex >= 0) {
      const existing = data.schedules[existingIndex];
      schedToSave = {
        ...existing,
        ...schedData,
        updatedAt: new Date().toISOString()
      };
      // Explicitly handle fields that can be null
      if (schedData.lastRun === null) schedToSave.lastRun = null;
      if (schedData.nextRun === null) schedToSave.nextRun = null;
      
      data.schedules[existingIndex] = schedToSave;
    } else {
      schedToSave = {
        id: schedData.id || crypto.randomUUID(),
        taskId: schedData.taskId,
        cronExpression: schedData.cronExpression,
        enabled: schedData.enabled !== undefined ? schedData.enabled : true,
        lastRun: schedData.lastRun || null,
        nextRun: schedData.nextRun || null,
        updatedAt: new Date().toISOString()
      };
      data.schedules.push(schedToSave);
    }

    writeDB(data);
    return schedToSave;
  },

  deleteSchedule(id) {
    const data = readDB();
    const originalLength = data.schedules.length;
    data.schedules = data.schedules.filter(s => s.id !== id);
    if (data.schedules.length !== originalLength) {
      writeDB(data);
      return true;
    }
    return false;
  },

  // Logs
  getLogs() {
    const data = readDB();
    // Return logs sorted by start date descending (newest first)
    return data.logs.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  },

  getLog(id) {
    const data = readDB();
    return data.logs.find(l => l.id === id) || null;
  },

  addLog(logData) {
    const data = readDB();
    const existingIndex = logData.id ? data.logs.findIndex(l => l.id === logData.id) : -1;

    const logToSave = {
      id: logData.id || crypto.randomUUID(),
      ...logData,
      createdAt: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      data.logs[existingIndex] = logToSave;
    } else {
      data.logs.push(logToSave);
    }

    if (data.logs.length > 200) {
      // Sort oldest first and shift
      data.logs.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
      const removedLogs = data.logs.slice(0, data.logs.length - 200);
      data.logs = data.logs.slice(data.logs.length - 200);

      // Clean up orphaned screenshots if any
      for (const log of removedLogs) {
        if (log.screenshotPath && fs.existsSync(log.screenshotPath)) {
          try { fs.unlinkSync(log.screenshotPath); } catch (_) {}
        }
        if (log.stepsExecuted) {
          for (const step of log.stepsExecuted) {
            if (step.screenshotPath && fs.existsSync(step.screenshotPath)) {
              try { fs.unlinkSync(step.screenshotPath); } catch (_) {}
            }
          }
        }
      }
    }

    writeDB(data);
    return logToSave;
  },

  clearLogs() {
    const data = readDB();
    // Delete all screenshot files
    for (const log of data.logs) {
      if (log.screenshotPath && fs.existsSync(log.screenshotPath)) {
        try { fs.unlinkSync(log.screenshotPath); } catch (_) {}
      }
      if (log.stepsExecuted) {
        for (const step of log.stepsExecuted) {
          if (step.screenshotPath && fs.existsSync(step.screenshotPath)) {
            try { fs.unlinkSync(step.screenshotPath); } catch (_) {}
          }
        }
      }
    }
    data.logs = [];
    writeDB(data);
    return true;
  },

  getSettings() {
    const data = readDB();
    if (!data.settings) {
      data.settings = { autoCleanEnabled: false, retentionDays: 30, startHookUrl: '', endHookUrl: '' };
    } else {
      data.settings.startHookUrl = data.settings.startHookUrl || '';
      data.settings.endHookUrl = data.settings.endHookUrl || '';
    }
    return data.settings;
  },

  saveSettings(settings) {
    const data = readDB();
    data.settings = {
      autoCleanEnabled: !!settings.autoCleanEnabled,
      retentionDays: parseInt(settings.retentionDays, 10) || 30,
      startHookUrl: settings.startHookUrl || '',
      endHookUrl: settings.endHookUrl || ''
    };
    writeDB(data);
    return data.settings;
  },

  importDatabase(newData) {
    if (!newData || typeof newData !== 'object') throw new Error('Dados inválidos');
    const validated = {
      blocks: Array.isArray(newData.blocks) ? newData.blocks : [],
      tasks: Array.isArray(newData.tasks) ? newData.tasks : [],
      schedules: Array.isArray(newData.schedules) ? newData.schedules : [],
      logs: Array.isArray(newData.logs) ? newData.logs : [],
      settings: newData.settings || { autoCleanEnabled: false, retentionDays: 30, startHookUrl: '', endHookUrl: '' }
    };
    writeDB(validated);
    return true;
  },

  cleanExpiredLogs() {
    const data = readDB();
    if (!data.settings || !data.settings.autoCleanEnabled) {
      return 0;
    }
    const retentionDays = parseInt(data.settings.retentionDays, 10) || 30;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - retentionDays);
    
    let deletedCount = 0;
    const activeLogs = [];
    
    for (const log of data.logs) {
      const logDate = new Date(log.startedAt || log.createdAt);
      if (logDate < thresholdDate) {
        deletedCount++;
        if (log.screenshotPath) {
          const fullPath = path.join(DATA_DIR, 'screenshots', path.basename(log.screenshotPath));
          try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (_) {}
        }
        if (log.stepsExecuted) {
          for (const step of log.stepsExecuted) {
            if (step.screenshotPath) {
              const fullPath = path.join(DATA_DIR, 'screenshots', path.basename(step.screenshotPath));
              try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (_) {}
            }
            if (step.downloadPath) {
              const fullPath = path.join(DATA_DIR, 'downloads', path.basename(step.downloadPath));
              try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (_) {}
            }
          }
        }
      } else {
        activeLogs.push(log);
      }
    }
    
    if (deletedCount > 0) {
      data.logs = activeLogs;
      writeDB(data);
      console.log(`Auto-cleanup: deleted ${deletedCount} logs older than ${retentionDays} days.`);
    }
    return deletedCount;
  }
};
