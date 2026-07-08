import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db } from './db/db.js';
import { runTask, activeControlSessions } from './runner/engine.js';
import { initScheduler, startSchedule, stopSchedule, isValidCron } from './scheduler/cron.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve captured screenshots statically
const DATA_DIR = path.resolve(__dirname, '../data');
const screenshotsPath = path.join(DATA_DIR, 'screenshots');
if (!fs.existsSync(screenshotsPath)) {
  fs.mkdirSync(screenshotsPath, { recursive: true });
}
app.use('/screenshots', express.static(screenshotsPath));

const downloadsPath = path.join(DATA_DIR, 'downloads');
if (!fs.existsSync(downloadsPath)) {
  fs.mkdirSync(downloadsPath, { recursive: true });
}
app.use('/downloads', express.static(downloadsPath));

// --- REST API ROUTES ---

// Password authentication status & verify routes
const SYSTEM_PASSWORD = process.env.SYSTEM_PASSWORD;

app.get('/api/auth/status', (req, res) => {
  res.json({ required: !!SYSTEM_PASSWORD });
});

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (!SYSTEM_PASSWORD || password === SYSTEM_PASSWORD) {
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Senha incorreta' });
});

// Middleware to protect API routes
app.use((req, res, next) => {
  if (SYSTEM_PASSWORD && req.path.startsWith('/api/') && !req.path.startsWith('/api/auth/')) {
    const authHeader = req.headers['x-system-password'];
    if (authHeader !== SYSTEM_PASSWORD) {
      return res.status(401).json({ error: 'Acesso não autorizado. Autenticação pendente.' });
    }
  }
  next();
});

// System settings & database management routes
app.get('/api/system/settings', (req, res) => {
  try {
    res.json(db.getSettings());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system/settings', (req, res) => {
  try {
    const saved = db.saveSettings(req.body);
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/db/export', (req, res) => {
  try {
    const fullDb = {
      blocks: db.getBlocks(),
      tasks: db.getTasks(),
      schedules: db.getSchedules(),
      logs: db.getLogs(),
      settings: db.getSettings()
    };
    res.json(fullDb);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system/db/import', (req, res) => {
  try {
    db.importDatabase(req.body);
    res.json({ success: true, message: 'Banco de dados importado com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system/clean/:type', (req, res) => {
  try {
    const { type } = req.params;
    if (type === 'logs') {
      db.clearLogs();
      cleanFolder(screenshotsPath);
      cleanFolder(downloadsPath);
      return res.json({ success: true, message: 'Logs e arquivos limpos!' });
    } else if (type === 'screenshots') {
      cleanFolder(screenshotsPath);
      return res.json({ success: true, message: 'Screenshots limpos!' });
    } else if (type === 'downloads') {
      cleanFolder(downloadsPath);
      return res.json({ success: true, message: 'Downloads limpos!' });
    }
    res.status(400).json({ error: 'Tipo de limpeza inválido' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function cleanFolder(dirPath) {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      try {
        if (fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
        }
      } catch (_) {}
    }
  }
}

// 1. Blocks API
app.get('/api/blocks', (req, res) => {
  try {
    const blocks = db.getBlocks();
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/blocks/:id', (req, res) => {
  try {
    const block = db.getBlock(req.params.id);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json(block);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/blocks', (req, res) => {
  try {
    const { id, name, description, steps, secrets, parameters } = req.body;
    if (!name) return res.status(400).json({ error: 'Block name is required' });
    
    const saved = db.saveBlock({ id, name, description, steps, secrets, parameters });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/blocks/:id', (req, res) => {
  try {
    const deleted = db.deleteBlock(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Block not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Tasks API
app.get('/api/tasks', (req, res) => {
  try {
    const tasks = db.getTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks/:id', (req, res) => {
  try {
    const task = db.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', (req, res) => {
  try {
    const { id, name, description, blockIds, blocks, antiDetection } = req.body;
    if (!name) return res.status(400).json({ error: 'Task name is required' });
    if ((!blockIds || !Array.isArray(blockIds)) && (!blocks || !Array.isArray(blocks))) {
      return res.status(400).json({ error: 'Block list is required' });
    }
    
    const saved = db.saveTask({ id, name, description, blockIds, blocks, antiDetection });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const deleted = db.deleteTask(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run task manual execution route
app.post('/api/tasks/:id/run', async (req, res) => {
  try {
    const task = db.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { parameterOverrides } = req.body;
    console.log(`Manual execution requested for Task "${task.name}" with overrides:`, JSON.stringify(parameterOverrides));
    
    const runId = crypto.randomUUID();
    // Execute asynchronously to avoid blocking the REST API request
    runTask(task.id, parameterOverrides, runId).catch(err => {
      console.error(`Asynchronous run for task ${task.id} failed:`, err);
    });

    res.json({ message: 'Execution started', taskId: task.id, runId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Schedules API
app.get('/api/schedules', (req, res) => {
  try {
    const schedules = db.getSchedules();
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/schedules', (req, res) => {
  try {
    const { id, taskId, cronExpression, enabled } = req.body;
    if (!taskId) return res.status(400).json({ error: 'Target Task ID is required' });
    if (!cronExpression) return res.status(400).json({ error: 'Cron expression is required' });

    if (!isValidCron(cronExpression)) {
      return res.status(400).json({ error: 'Invalid Cron Expression syntax' });
    }

    const saved = db.saveSchedule({ id, taskId, cronExpression, enabled });
    
    // Handle registration in cron system
    if (saved.enabled) {
      startSchedule(saved);
    } else {
      stopSchedule(saved.id);
    }

    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/schedules/:id', (req, res) => {
  try {
    const deleted = db.deleteSchedule(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Schedule not found' });
    
    // De-register job
    stopSchedule(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Logs API
app.get('/api/logs', (req, res) => {
  try {
    const logs = db.getLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/logs', (req, res) => {
  try {
    db.clearLogs();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 5. AGENT BROWSER CONTROL API ---

// GET /api/agent/sessions - Retrieve all active runs waiting for or controlled by an agent
app.get('/api/agent/sessions', (req, res) => {
  try {
    const { runId } = req.query;
    if (runId) {
      const session = activeControlSessions.get(runId);
      if (!session) {
        return res.status(404).json({ error: `Session with runId ${runId} not found` });
      }
      return res.json({
        runId,
        stepIndex: session.stepIndex,
        status: session.status
      });
    }

    const sessionsList = [];
    for (const [rId, session] of activeControlSessions.entries()) {
      sessionsList.push({
        runId: rId,
        stepIndex: session.stepIndex,
        status: session.status
      });
    }
    res.json(sessionsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agent/acquire - Agent takes control of the browser session
app.post('/api/agent/acquire', (req, res) => {
  try {
    const { runId } = req.body;
    if (!runId) return res.status(400).json({ error: 'runId is required' });

    const session = activeControlSessions.get(runId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    if (session.status !== 'waiting') {
      return res.status(400).json({ error: `Session is already in status: ${session.status}` });
    }

    // Stop the acquire timeout
    if (session.acquireTimeoutTimer) {
      clearTimeout(session.acquireTimeoutTimer);
      session.acquireTimeoutTimer = null;
    }

    // Set status to acquired
    session.status = 'acquired';

    // Start the execution timeout timer
    const timeoutMs = session.executionTimeoutMs || 120000;
    session.executionTimeoutTimer = setTimeout(() => {
      activeControlSessions.delete(runId);
      session.rejectPromise(new Error(`Excedeu o tempo limite (${timeoutMs / 1000}s) para execução do agente.`));
    }, timeoutMs);

    console.log(`Agent successfully acquired control of session ${runId}. Start execution timeout timer: ${timeoutMs}ms.`);
    res.json({ success: true, status: 'acquired' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agent/execute - Execute browser commands
app.post('/api/agent/execute', async (req, res) => {
  try {
    const { runId, action, params } = req.body;
    if (!runId) return res.status(400).json({ error: 'runId is required' });
    if (!action) return res.status(400).json({ error: 'action is required' });

    const session = activeControlSessions.get(runId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    if (session.status !== 'acquired') {
      return res.status(400).json({ error: 'Session is not acquired yet. Call /api/agent/acquire first.' });
    }

    const page = session.page;
    let result = null;

    switch (action) {
      case 'eval':
        if (!params || !params.script) return res.status(400).json({ error: 'eval action requires params.script' });
        result = await page.evaluate(params.script);
        break;
      case 'navigate':
        if (!params || !params.url) return res.status(400).json({ error: 'navigate action requires params.url' });
        await page.goto(params.url, { waitUntil: 'load', timeout: 30000 });
        result = { success: true };
        break;
      case 'click':
        if (!params || !params.selector) return res.status(400).json({ error: 'click action requires params.selector' });
        await page.click(params.selector, { timeout: 15000 });
        result = { success: true };
        break;
      case 'fill':
        if (!params || !params.selector) return res.status(400).json({ error: 'fill action requires params.selector' });
        await page.fill(params.selector, params.value || '', { timeout: 15000 });
        result = { success: true };
        break;
      case 'screenshot':
        const base64 = await page.screenshot({ encoding: 'base64', fullPage: true });
        result = { base64: `data:image/png;base64,${base64}` };
        break;
      case 'html':
        result = await page.content();
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agent/release - Agent yields control back to resume pipeline
app.post('/api/agent/release', (req, res) => {
  try {
    const { runId } = req.body;
    if (!runId) return res.status(400).json({ error: 'runId is required' });

    const session = activeControlSessions.get(runId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    if (session.status !== 'acquired') {
      return res.status(400).json({ error: 'Session is not currently acquired.' });
    }

    // Clear execution timeout timer
    if (session.executionTimeoutTimer) {
      clearTimeout(session.executionTimeoutTimer);
      session.executionTimeoutTimer = null;
    }

    // Delete session and resolve promise
    activeControlSessions.delete(runId);
    session.resolvePromise();

    console.log(`Agent released control of session ${runId}. Resuming pipeline.`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PRODUCTION SERVING OF COMPILED REACT FRONTEND ---
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  console.log(`Production Mode: Serving client assets from ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  
  // Catch-all route to serve the SPA client for deep routes (except API/screenshots/downloads)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/screenshots') || req.path.startsWith('/downloads')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  console.log('Development Mode: Not serving compiled frontend assets (Vite dev server handles client)');
}

// Start Server and Cron scheduler
app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
  initScheduler();
});
