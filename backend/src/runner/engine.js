import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../db/db.js';
import { decrypt } from '../utils/crypto.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Active control sessions map for agent handoff
export const activeControlSessions = new Map();

// Active interactive user prompt sessions map
export const activePromptSessions = new Map();

// Active real-time screencast streams for pipeline runs
export const activeRunStreams = new Map();


/**
 * Replace secret and parameter references in text
 */
export function resolveText(text, decryptedSecrets = {}, mergedParams = {}) {
  if (typeof text !== 'string') return text;
  
  // 1. Resolve parameters first
  let resolved = text.replace(/\{\{param:([^}]+)\}\}/g, (match, paramName) => {
    if (mergedParams[paramName] !== undefined) {
      return mergedParams[paramName];
    }
    return ''; // Fallback empty string if not defined
  });

  // 2. Resolve secrets second
  resolved = resolved.replace(/\{\{secret:([^}]+)\}\}/g, (match, key) => {
    if (decryptedSecrets[key] !== undefined) {
      return decryptedSecrets[key];
    }
    return match; // Keep unresolved variables
  });

  return resolved;
}

/**
 * Mask secret references in logged step parameters for privacy
 */
function maskParameters(step) {
  const masked = JSON.parse(JSON.stringify(step));
  const mask = (val) => {
    if (typeof val !== 'string') return val;
    return val.replace(/\{\{secret:([^}]+)\}\}/g, '●●●●●●');
  };

  const fieldsToMask = ['url', 'text', 'selector', 'selector_exists', 'query_selector', 'key'];
  for (const field of fieldsToMask) {
    if (masked[field]) masked[field] = mask(masked[field]);
  }
  return masked;
}

function hasCssSpecifiers(selector) {
  return selector.includes('.') || 
         selector.includes('[') || 
         selector.includes(' ') || 
         selector.includes('>') || 
         selector.includes(':') || 
         (selector.includes('#') && !selector.startsWith('#'));
}

/**
 * Convert user click selectors into Playwright selector syntax
 */
export function getPlaywrightSelector(selector, type) {
  if (!selector) return '';
  const trimmed = selector.trim();

  switch (type) {
    case 'id':
      if (trimmed.startsWith('xpath=') || trimmed.startsWith('//') || trimmed.startsWith('(//') || hasCssSpecifiers(trimmed)) {
        return trimmed.startsWith('//') || trimmed.startsWith('(//') ? (trimmed.startsWith('xpath=') ? trimmed : `xpath=${trimmed}`) : trimmed;
      }
      return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

    case 'class':
      if (trimmed.startsWith('xpath=') || trimmed.startsWith('//') || trimmed.startsWith('(//') || hasCssSpecifiers(trimmed)) {
        return trimmed.startsWith('//') || trimmed.startsWith('(//') ? (trimmed.startsWith('xpath=') ? trimmed : `xpath=${trimmed}`) : trimmed;
      }
      return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;

    case 'xpath':
      return trimmed.startsWith('xpath=') ? trimmed : `xpath=${trimmed}`;

    case 'text':
      return trimmed.startsWith('text=') ? trimmed : `text="${trimmed}"`;

    case 'css':
    default:
      if (trimmed.startsWith('//') || trimmed.startsWith('(//')) {
        return `xpath=${trimmed}`;
      }
      return trimmed;
  }
}

async function triggerWebhook(url, payload) {
  if (!url) return;
  console.log(`Triggering webhook: ${url}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`Webhook response status: ${res.status}`);
  } catch (err) {
    console.error(`Webhook call failed for ${url}:`, err.message);
  }
}

/**
 * Run a single Task Pipeline
 * @param {string} taskId - The ID of the task to execute
 * @param {Object} [parameterOverrides={}] - Execution-time overrides keyed by block instance ID
 * @returns {Promise<Object>} The run log record
 */
export async function runTask(
  taskId,
  parameterOverrides = {},
  runId = crypto.randomUUID(),
  runtimeVars = {},
  skipVars = [],
  trigger = 'manual',
  scheduleId = null,
  options = {}
) {
  const startedAt = new Date().toISOString();
  const task = db.getTask(taskId);
  if (!task) {
    const errorRecord = {
      id: runId,
      taskId: taskId,
      taskName: 'Pipeline Não Encontrada',
      trigger,
      scheduleId,
      status: 'failure',
      startedAt,
      endedAt: startedAt,
      duration: 0,
      currentBlockId: null,
      currentBlockName: null,
      currentStepIndex: -1,
      error: `A tarefa/pipeline com ID "${taskId}" não foi encontrada no banco de dados.`,
      stepsExecuted: [],
      screenshotPath: null
    };
    db.addLog(errorRecord);
    throw new Error(errorRecord.error);
  }

  const isHeadless = options.headless !== undefined
    ? Boolean(options.headless)
    : (process.env.HEADLESS !== 'false');

  const isLiveView = options.liveView !== undefined
    ? Boolean(options.liveView)
    : true;

  const logRecord = {
    id: runId,
    taskId: task.id,
    taskName: task.name,
    trigger,
    scheduleId,
    status: 'running',
    startedAt,
    endedAt: null,
    duration: 0,
    currentBlockId: null,
    currentBlockName: null,
    currentStepIndex: -1,
    error: null,
    stepsExecuted: [],
    screenshotPath: null,
    headless: isHeadless,
    liveView: isLiveView
  };

  // Pre-load all action blocks with instance values to ensure they exist before starting browser
  const blocks = [];
  const blockInstances = task.blocks || [];
  for (const instance of blockInstances) {
    const block = db.getBlock(instance.blockId, false); // Get RAW block with encrypted secrets
    if (!block) {
      logRecord.status = 'failure';
      logRecord.endedAt = new Date().toISOString();
      logRecord.error = `Block dependency with ID ${instance.blockId} was not found`;
      db.addLog(logRecord);
      return logRecord;
    }
    blocks.push({
      definition: block,
      instance: instance
    });
  }

  logRecord.status = 'running';
  db.addLog(logRecord); // Write log state so the UI picks it up immediately

  const settings = db.getSettings();
  const startHookUrl = settings.startHookUrl;
  const endHookUrl = settings.endHookUrl;

  if (startHookUrl) {
    triggerWebhook(startHookUrl, {
      event: 'pipeline_started',
      runId,
      taskId,
      taskName: task.name,
      trigger,
      scheduleId,
      startedAt
    }).catch(() => {});
  }

  let browser = null;
  let context = null;
  let page = null;
  let skipNextStep = false;
  let runStream = null;

  try {
    console.log(`Starting execution of Task: "${task.name}" (${taskId}) - Headless: ${isHeadless}, LiveView: ${isLiveView}`);
    
    const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    if (task.antiDetection) {
      launchArgs.push('--disable-blink-features=AutomationControlled');
    }

    // Launch chromium with user-selected headless mode
    browser = await chromium.launch({
      headless: isHeadless,
      args: launchArgs
    });

    const contextOptions = {
      viewport: { width: 1280, height: 720 }
    };

    if (task.antiDetection) {
      console.log('Anti-Detection mode enabled for task browser context.');
      contextOptions.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      contextOptions.extraHTTPHeaders = {
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      };
    }

    context = await browser.newContext(contextOptions);

    if (task.antiDetection) {
      // Overwrite webdriver navigator flag and chrome objects
      await context.addInitScript(() => {
        // Delete webdriver from Prototype to bypass modern detection
        try {
          delete Navigator.prototype.webdriver;
        } catch (e) {}
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        };
        Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      });
    }

    page = await context.newPage();

    // Start live screencast stream if requested
    if (isLiveView) {
      runStream = {
        clients: new Set(),
        lastFrame: null,
        cdp: null
      };
      activeRunStreams.set(runId, runStream);

      try {
        const cdp = await context.newCDPSession(page);
        runStream.cdp = cdp;
        await cdp.send('Page.startScreencast', {
          format: 'jpeg',
          quality: 75,
          maxWidth: 1280,
          maxHeight: 720,
          everyNthFrame: 1
        });

        cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
          try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch (_) {}
          const buffer = Buffer.from(data, 'base64');
          runStream.lastFrame = buffer;
          for (const sendFrame of runStream.clients) {
            try { sendFrame(buffer); } catch (_) {}
          }
        });

        page.screenshot({ type: 'jpeg', quality: 75 }).then(buf => {
          runStream.lastFrame = buf;
        }).catch(() => {});
      } catch (screencastErr) {
        console.warn(`[Engine] Could not start CDP screencast for run ${runId}:`, screencastErr.message);
      }
    }

    // Iterate through modules (blocks)
    for (let bIndex = 0; bIndex < blocks.length; bIndex++) {
      const { definition: block, instance } = blocks[bIndex];
      logRecord.currentBlockId = block.id;
      logRecord.currentBlockName = block.name;
      
      console.log(`Executing Block: "${block.name}" (${bIndex + 1}/${blocks.length})`);

      // Decrypt secrets for this block
      const decryptedSecrets = {};
      if (block.secrets) {
        for (const [key, encVal] of Object.entries(block.secrets)) {
          decryptedSecrets[key] = decrypt(encVal);
        }
      }

      // Merge parameters: Block Defaults < Task Overrides < Runtime Overrides < Runtime Vars
      const mergedParams = {};
      if (block.parameters && Array.isArray(block.parameters)) {
        for (const param of block.parameters) {
          if (param.name) {
            mergedParams[param.name] = param.defaultValue || '';
          }
        }
      }
      if (instance.parameterValues) {
        for (const [key, val] of Object.entries(instance.parameterValues)) {
          if (val !== undefined && val !== '') {
            mergedParams[key] = val;
          }
        }
      }
      const instanceOverrides = parameterOverrides?.[instance.id];
      if (instanceOverrides) {
        for (const [key, val] of Object.entries(instanceOverrides)) {
          if (val !== undefined && val !== '') {
            mergedParams[key] = val;
          }
        }
      }
      if (runtimeVars && typeof runtimeVars === 'object') {
        for (const [key, val] of Object.entries(runtimeVars)) {
          if (val !== undefined && val !== '') {
            mergedParams[key] = val;
          }
        }
      }

      // Iterate through steps inside block
      for (let sIndex = 0; sIndex < block.steps.length; sIndex++) {
        const step = block.steps[sIndex];
        logRecord.currentStepIndex = sIndex;

        const maskedStep = maskParameters(step);
        const stepLog = {
          blockId: block.id,
          blockName: block.name,
          stepIndex: sIndex,
          type: step.type,
          params: maskedStep,
          status: 'running',
          startedAt: new Date().toISOString(),
          endedAt: null,
          error: null,
          data: null,
          screenshotPath: null
        };

        logRecord.stepsExecuted.push(stepLog);
        db.addLog(logRecord); // Update log state so UI shows step as running

        // Handle conditional skipping
        if (skipNextStep) {
          console.log(`Skipping Step: ${step.type} due to conditional execution check`);
          stepLog.status = 'skipped';
          stepLog.endedAt = new Date().toISOString();
          skipNextStep = false;
          continue;
        }

        try {
          // Process individual steps
          switch (step.type) {
            case 'navigate': {
              const url = resolveText(step.url, decryptedSecrets, mergedParams);
              if (!url) throw new Error('Navigate command requires a URL parameter');
              console.log(`Navigating to: ${url}`);
              await page.goto(url, { waitUntil: 'load', timeout: 30000 });
              break;
            }

            case 'click': {
              const selector = resolveText(step.selector, decryptedSecrets, mergedParams);
              if (!selector) throw new Error('Click command requires a selector');
              const pwSelector = getPlaywrightSelector(selector, step.selector_type);
              console.log(`Clicking element: ${pwSelector}`);
              
              // Wait for element to be attached first
              await page.waitForSelector(pwSelector, { state: 'attached', timeout: 15000 });
              await page.click(pwSelector, { timeout: 15000 });
              break;
            }

            case 'type': {
              const selector = resolveText(step.selector, decryptedSecrets, mergedParams);
              const text = resolveText(step.text, decryptedSecrets, mergedParams);
              if (!selector) throw new Error('Type command requires a selector');
              
              console.log(`Typing into: ${selector}`);
              if (step.selector_type === 'label') {
                // Find element by label text
                const locator = page.getByLabel(selector, { exact: false });
                await locator.fill(text || '', { timeout: 15000 });
              } else if (step.selector_type === 'placeholder') {
                // Find element by placeholder text
                const locator = page.getByPlaceholder(selector, { exact: false });
                await locator.fill(text || '', { timeout: 15000 });
              } else {
                const pwSelector = getPlaywrightSelector(selector, step.selector_type);
                await page.waitForSelector(pwSelector, { state: 'attached', timeout: 15000 });
                await page.fill(pwSelector, text || '', { timeout: 15000 });
              }
              break;
            }

            case 'wait': {
              const condition = step.condition || 'load';
              const timeoutSec = parseInt(step.timeout, 10) || 30;
              const timeoutMs = timeoutSec * 1000;
              if (condition === 'load') {
                console.log(`Waiting for load state (timeout: ${timeoutSec}s)...`);
                await page.waitForLoadState('load', { timeout: timeoutMs });
              } else if (condition === 'visible') {
                const selector = resolveText(step.selector, decryptedSecrets, mergedParams);
                if (!selector) throw new Error('Wait visible command requires a selector');
                const pwSelector = getPlaywrightSelector(selector, step.selector_type);
                console.log(`Waiting for element visibility: ${pwSelector} (timeout: ${timeoutSec}s)`);
                await page.waitForSelector(pwSelector, { state: 'visible', timeout: timeoutMs });
              }
              break;
            }

            case 'press_key': {
              const key = step.key;
              if (!key) throw new Error('PressKey command requires a key identifier');
              console.log(`Pressing keyboard key: ${key}`);
              await page.keyboard.press(key);
              break;
            }

            case 'extract_html': {
              console.log('Extracting page source HTML...');
              const html = await page.content();
              stepLog.data = { html };
              break;
            }

            case 'list_elements': {
              const query = resolveText(step.query_selector, decryptedSecrets, mergedParams);
              if (!query) throw new Error('ListElements command requires a query selector');
              console.log(`Listing elements for query: ${query}`);
              
              const pwSelector = getPlaywrightSelector(query, step.selector_type || 'css');
              const locator = page.locator(pwSelector);
              const count = await locator.count();
              const elements = [];
              for (let i = 0; i < count; i++) {
                const el = locator.nth(i);
                const text = (await el.innerText().catch(() => '')) || '';
                const html = (await el.evaluate(node => node.outerHTML).catch(() => '')) || '';
                const attributes = await el.evaluate(node => {
                  return Array.from(node.attributes).reduce((acc, attr) => {
                    acc[attr.name] = attr.value;
                    return acc;
                  }, {});
                }).catch(() => ({}));
                elements.push({ text: text.trim(), html, attributes });
              }
              stepLog.data = { count: elements.length, elements };
              break;
            }

            case 'take_screenshot': {
              const filename = `screenshot_${taskId}_${Date.now()}.png`;
              const filePath = path.join(SCREENSHOTS_DIR, filename);
              console.log(`Saving manual screenshot to: ${filePath}`);
              
              await page.screenshot({ path: filePath, fullPage: true });
              
              stepLog.screenshotPath = `/screenshots/${filename}`;
              break;
            }

            case 'eval': {
              const script = resolveText(step.script, decryptedSecrets, mergedParams);
              if (!script) throw new Error("O script da etapa 'eval' não foi fornecido.");
              console.log(`Evaluating script: ${script.substring(0, 60)}...`);
              const output = await page.evaluate(script);

              console.log(`[JSEval] Return value:`, typeof output === 'object' ? JSON.stringify(output) : output);

              // Step data with explicit return value
              stepLog.data = {
                result: output !== undefined ? output : null,
                returnValue: output !== undefined ? output : null,
                hasOutput: output !== undefined,
                message: output !== undefined
                  ? (typeof output === 'object' && output !== null
                      ? `Retorno capturado (${Array.isArray(output) ? `${output.length} itens` : 'Objeto'}).`
                      : `Retorno: ${String(output).substring(0, 150)}${String(output).length > 150 ? '...' : ''}`)
                  : 'Script JS executado com sucesso (sem retorno explícito).'
              };

              // If output_file is configured, persist the return value to disk and download area
              const rawOutputFile = (step.output_file || '').trim();
              if (rawOutputFile) {
                const resolvedFilename = resolveText(rawOutputFile, decryptedSecrets, mergedParams).trim();
                if (resolvedFilename) {
                  const safeFilename = path.basename(resolvedFilename);
                  const uniqueFilename = `download_${runId}_${safeFilename}`;
                  const filePath = path.join(DOWNLOADS_DIR, uniqueFilename);

                  console.log(`[JSEval] Writing return value to download file: ${filePath}`);
                  let fileContent = '';
                  if (typeof output === 'string') {
                    fileContent = output;
                  } else if (output !== undefined && output !== null) {
                    fileContent = typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output);
                  } else {
                    fileContent = '';
                  }

                  if (!fs.existsSync(DOWNLOADS_DIR)) {
                    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
                  }
                  fs.writeFileSync(filePath, fileContent, 'utf-8');

                  // Also save directly to relative or absolute path in workspace
                  try {
                    const directPath = path.isAbsolute(resolvedFilename)
                      ? resolvedFilename
                      : path.resolve(process.cwd(), resolvedFilename);
                    const directDir = path.dirname(directPath);
                    if (!fs.existsSync(directDir)) {
                      fs.mkdirSync(directDir, { recursive: true });
                    }
                    fs.writeFileSync(directPath, fileContent, 'utf-8');
                    console.log(`[JSEval] Also saved output directly to: ${directPath}`);
                    stepLog.data.savedFilePath = directPath;
                  } catch (directErr) {
                    console.warn(`[JSEval] Note: Could not save direct file to ${resolvedFilename}:`, directErr.message);
                  }

                  stepLog.downloadPath = `/downloads/${uniqueFilename}`;
                  stepLog.downloadName = safeFilename;
                  stepLog.data.outputFile = safeFilename;
                  stepLog.data.fileSize = Buffer.byteLength(fileContent, 'utf-8');
                }
              }
              break;
            }

            case 'conditional_if': {
              const selector = resolveText(step.selector_exists, decryptedSecrets, mergedParams);
              if (!selector) throw new Error('ConditionalIf command requires a selector_exists parameter');
              const pwSelector = getPlaywrightSelector(selector, step.selector_type);
              console.log(`Evaluating if selector exists: ${pwSelector}`);
              
              // Wait briefly to check if it's there
              const exists = (await page.locator(pwSelector).count()) > 0;
              console.log(`Condition result: ${exists}`);
              
              stepLog.data = { conditionMet: exists };
              skipNextStep = !exists; // If condition is false, skip the next step
              break;
            }

            case 'agent_control': {
              const acquireTimeoutSec = parseInt(step.acquireTimeout, 10) || 60;
              const executionTimeoutSec = parseInt(step.executionTimeout, 10) || 120;
              console.log(`Pipeline paused. Waiting for external agent control (acquire timeout: ${acquireTimeoutSec}s, execution timeout: ${executionTimeoutSec}s)...`);

              stepLog.status = 'running';
              stepLog.data = { message: 'Aguardando agente assumir o controle...' };
              db.addLog(logRecord); // Write log state so the UI picks it up

              await new Promise((resolve, reject) => {
                const session = {
                  runId,
                  stepIndex: sIndex,
                  page,
                  status: 'waiting',
                  acquireTimeoutTimer: null,
                  executionTimeoutTimer: null,
                  resolvePromise: resolve,
                  rejectPromise: reject
                };

                activeControlSessions.set(runId, session);

                // Start acquire timeout
                session.acquireTimeoutTimer = setTimeout(() => {
                  if (session.status === 'waiting') {
                    activeControlSessions.delete(runId);
                    reject(new Error(`Excedeu o tempo limite (${acquireTimeoutSec}s) para o agente assumir o controle do navegador.`));
                  }
                }, acquireTimeoutSec * 1000);

                // Export execution timeout config to session so the acquire endpoint can start it
                session.executionTimeoutMs = executionTimeoutSec * 1000;
              });
              
              stepLog.data = { message: 'Controle do agente finalizado com sucesso.' };
              console.log('Agent control finished. Resuming pipeline execution...');
              break;
            }

            case 'user_prompt': {
              const stepVars = Array.isArray(step.vars) ? step.vars : [];
              const promptTimeoutSec = parseInt(step.acquireTimeout, 10) || 1800; // Long default: 30 minutes!
              const promptTitle = step.title || 'Preenchimento de Variáveis';
              const promptDescription = step.description || '';
              const skipVarList = Array.isArray(skipVars) ? skipVars : [];

              // Check if ALL variables defined in this step were marked to skip
              const allSkipped = stepVars.length > 0 && stepVars.every(v => skipVarList.includes(v.name));

              if (allSkipped) {
                console.log(`Skipping interactive prompt "${promptTitle}" because all variables were pre-filled and marked to skip.`);
                for (const v of stepVars) {
                  const val = runtimeVars[v.name] !== undefined && runtimeVars[v.name] !== ''
                    ? runtimeVars[v.name]
                    : (mergedParams[v.name] !== undefined && mergedParams[v.name] !== '' ? mergedParams[v.name] : (v.defaultValue !== undefined ? v.defaultValue : ''));
                  mergedParams[v.name] = val;
                  runtimeVars[v.name] = val;
                }
                stepLog.status = 'success';
                stepLog.data = {
                  skipped: true,
                  message: 'Pausa interativa pulada conforme configurado no início da execução.',
                  values: { ...runtimeVars }
                };
                break;
              }

              // Not all skipped: pause and prompt user
              console.log(`Pipeline paused at user_prompt: "${promptTitle}". Waiting for input (timeout: ${promptTimeoutSec}s)...`);

              // Evaluate dynamic_script if provided in page context
              let dynamicData = null;
              if (step.dynamic_script) {
                try {
                  const resolvedScript = resolveText(step.dynamic_script, decryptedSecrets, mergedParams);
                  if (resolvedScript) {
                    console.log('Evaluating dynamic_script for user_prompt in page context...');
                    dynamicData = await page.evaluate(resolvedScript);
                  }
                } catch (scriptErr) {
                  console.error('Error evaluating dynamic_script in user_prompt:', scriptErr.message);
                  dynamicData = { error: scriptErr.message };
                }
              }

              // Prepare prefilled variables with runtime/default values
              const prefilledVars = stepVars.map(v => {
                const val = runtimeVars[v.name] !== undefined && runtimeVars[v.name] !== ''
                  ? runtimeVars[v.name]
                  : (mergedParams[v.name] !== undefined && mergedParams[v.name] !== '' ? mergedParams[v.name] : (v.defaultValue !== undefined ? v.defaultValue : ''));
                return {
                  name: v.name,
                  label: v.label || v.name,
                  value: val,
                  defaultValue: v.defaultValue !== undefined ? v.defaultValue : ''
                };
              });

              stepLog.status = 'running';
              stepLog.data = {
                isUserPrompt: true,
                promptTitle,
                promptDescription,
                vars: prefilledVars,
                dynamicData,
                timeoutSec: promptTimeoutSec
              };
              db.addLog(logRecord); // Write log state so UI picks up the prompt immediately

              const submittedValues = await new Promise((resolve, reject) => {
                const session = {
                  runId,
                  stepIndex: sIndex,
                  status: 'waiting',
                  promptTitle,
                  promptDescription,
                  vars: prefilledVars,
                  dynamicData,
                  timeoutTimer: null,
                  resolvePromise: resolve,
                  rejectPromise: reject
                };

                activePromptSessions.set(runId, session);

                session.timeoutTimer = setTimeout(() => {
                  if (activePromptSessions.has(runId)) {
                    activePromptSessions.delete(runId);
                    reject(new Error(`Excedeu o tempo limite (${promptTimeoutSec}s) para preenchimento das variáveis na interface.`));
                  }
                }, promptTimeoutSec * 1000);
              });

              // Apply submitted values to mergedParams and runtimeVars
              if (submittedValues && typeof submittedValues === 'object') {
                for (const [k, val] of Object.entries(submittedValues)) {
                  mergedParams[k] = val;
                  runtimeVars[k] = val;
                }
              }

              stepLog.data = {
                isUserPrompt: true,
                completed: true,
                submittedValues: { ...submittedValues },
                message: 'Variáveis preenchidas e confirmadas com sucesso.'
              };
              console.log(`Interactive prompt "${promptTitle}" completed. Updated parameters:`, submittedValues);
              break;
            }

            default:
              throw new Error(`Unknown step action type: "${step.type}"`);
          }

          stepLog.status = 'success';
          stepLog.endedAt = new Date().toISOString();
          db.addLog(logRecord); // Update log state so UI shows step as completed
        } catch (stepError) {
          console.error(`Step failed execution: ${stepError.message}`);
          stepLog.status = 'failure';
          stepLog.endedAt = new Date().toISOString();
          stepLog.error = stepError.message;

          // Attempt failure screenshot
          try {
            const errFilename = `error_${taskId}_${Date.now()}.png`;
            const errFilePath = path.join(SCREENSHOTS_DIR, errFilename);
            await page.screenshot({ path: errFilePath });
            stepLog.screenshotPath = `/screenshots/${errFilename}`;
            logRecord.screenshotPath = `/screenshots/${errFilename}`; // Also set main log screenshot
          } catch (screenshotErr) {
            console.error('Failed to capture error screenshot:', screenshotErr.message);
          }

          throw stepError; // Re-throw to halt task pipeline
        }
      }
    }

    logRecord.status = 'success';
    console.log(`Task "${task.name}" completed successfully`);
  } catch (error) {
    console.error(`Task "${task.name}" failed:`, error.message);
    logRecord.status = 'failure';
    logRecord.error = error.message;
  } finally {
    const endedAt = new Date().toISOString();
    logRecord.endedAt = endedAt;
    logRecord.duration = Math.round((new Date(endedAt) - new Date(startedAt)) / 1000);

    // Close CDP screencast stream if active
    if (activeRunStreams.has(runId)) {
      const stream = activeRunStreams.get(runId);
      if (stream.cdp) {
        try { await stream.cdp.detach(); } catch (_) {}
      }
      activeRunStreams.delete(runId);
    }

    // Close browser resources
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    
    // Write final log status to DB
    db.addLog(logRecord);

    if (endHookUrl) {
      triggerWebhook(endHookUrl, {
        event: 'pipeline_completed',
        runId,
        taskId,
        taskName: task.name,
        trigger,
        scheduleId,
        status: logRecord.status,
        startedAt,
        endedAt,
        duration: logRecord.duration,
        error: logRecord.error,
        stepsExecuted: logRecord.stepsExecuted
      }).catch(() => {});
    }
  }

  return logRecord;
}
export default runTask;
