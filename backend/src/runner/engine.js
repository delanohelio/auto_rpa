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


/**
 * Replace secret and parameter references in text
 */
function resolveText(text, decryptedSecrets = {}, mergedParams = {}) {
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
function getPlaywrightSelector(selector, type) {
  switch (type) {
    case 'id':
      if (hasCssSpecifiers(selector)) return selector;
      return selector.startsWith('#') ? selector : `#${selector}`;
    case 'class':
      if (hasCssSpecifiers(selector)) return selector;
      return selector.startsWith('.') ? selector : `.${selector}`;
    case 'xpath':
      return selector.startsWith('xpath=') ? selector : `xpath=${selector}`;
    case 'text':
      return `text="${selector}"`;
    default:
      return selector;
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
export async function runTask(taskId, parameterOverrides = {}, runId = crypto.randomUUID()) {
  const task = db.getTask(taskId);
  if (!task) {
    throw new Error(`Task with ID ${taskId} not found`);
  }
  const startedAt = new Date().toISOString();
  
  const logRecord = {
    id: runId,
    taskId: task.id,
    taskName: task.name,
    status: 'running',
    startedAt,
    endedAt: null,
    duration: 0,
    currentBlockId: null,
    currentBlockName: null,
    currentStepIndex: -1,
    error: null,
    stepsExecuted: [],
    screenshotPath: null
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
      startedAt
    }).catch(() => {});
  }

  let browser = null;
  let context = null;
  let page = null;
  let skipNextStep = false;

  try {
    console.log(`Starting execution of Task: "${task.name}" (${taskId})`);
    
    const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    if (task.antiDetection) {
      launchArgs.push('--disable-blink-features=AutomationControlled');
    }

    // Launch headless chromium with sandbox disable args for Docker container compatibility
    browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
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

      // Merge parameters: Block Defaults < Task Overrides < Runtime Overrides
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
              if (step.selector_type === 'id') {
                const pwSelector = (selector.startsWith('#') || hasCssSpecifiers(selector)) ? selector : `#${selector}`;
                await page.waitForSelector(pwSelector, { state: 'attached', timeout: 15000 });
                await page.fill(pwSelector, text || '', { timeout: 15000 });
              } else if (step.selector_type === 'label') {
                // Find element by label text
                const locator = page.getByLabel(selector, { exact: false });
                await locator.fill(text || '', { timeout: 15000 });
              } else if (step.selector_type === 'placeholder') {
                // Find element by placeholder text
                const locator = page.getByPlaceholder(selector, { exact: false });
                await locator.fill(text || '', { timeout: 15000 });
              } else {
                // Fallback direct selector type
                await page.waitForSelector(selector, { state: 'attached', timeout: 15000 });
                await page.fill(selector, text || '', { timeout: 15000 });
              }
              break;
            }

            case 'wait': {
              const condition = step.condition || 'load';
              if (condition === 'load') {
                console.log('Waiting for load state...');
                await page.waitForLoadState('load', { timeout: 30000 });
              } else if (condition === 'visible') {
                const selector = resolveText(step.selector, decryptedSecrets, mergedParams);
                if (!selector) throw new Error('Wait visible command requires a selector');
                console.log(`Waiting for element visibility: ${selector}`);
                await page.waitForSelector(selector, { state: 'visible', timeout: 30000 });
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
              
              const elements = await page.$$eval(query, els => {
                return els.map(el => ({
                  text: el.textContent ? el.textContent.trim() : '',
                  html: el.outerHTML,
                  attributes: Array.from(el.attributes).reduce((acc, attr) => {
                    acc[attr.name] = attr.value;
                    return acc;
                  }, {})
                }));
              });
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
              stepLog.data = { result: output };

              if (step.output_file) {
                const resolvedFilename = resolveText(step.output_file, decryptedSecrets, mergedParams);
                const safeFilename = path.basename(resolvedFilename);
                const uniqueFilename = `download_${runId}_${safeFilename}`;
                const filePath = path.join(DOWNLOADS_DIR, uniqueFilename);

                console.log(`Writing eval output to file: ${filePath}`);
                const fileContent = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
                fs.writeFileSync(filePath, fileContent, 'utf-8');

                stepLog.downloadPath = `/downloads/${uniqueFilename}`;
                stepLog.downloadName = safeFilename;
              }
              break;
            }

            case 'conditional_if': {
              const selector = resolveText(step.selector_exists, decryptedSecrets, mergedParams);
              if (!selector) throw new Error('ConditionalIf command requires a selector_exists parameter');
              console.log(`Evaluating if selector exists: ${selector}`);
              
              // Wait briefly to check if it's there
              const exists = (await page.locator(selector).count()) > 0;
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
