import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPlaywrightSelector, resolveText } from './engine.js';
import { db } from '../db/db.js';
import { decrypt } from '../utils/crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

class SandboxManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.cdpSession = null;
    this.screencastClients = new Set();
    this.lastFrame = null;
    this.headless = true;
    this.isLaunching = false;
    this.activeSessionId = null;
  }

  /**
   * Initializes or re-initializes the live browser session
   */
  async initSession({ headless = true, antiDetection = true } = {}) {
    // If already running with same headless mode and page open, return active session
    if (
      this.browser &&
      this.context &&
      this.page &&
      !this.page.isClosed() &&
      this.headless === headless
    ) {
      return {
        ready: true,
        currentUrl: this.page.url(),
        headless: this.headless
      };
    }

    if (this.isLaunching) {
      // Wait briefly for current launch to finish
      await new Promise(r => setTimeout(r, 600));
      if (this.page && !this.page.isClosed()) {
        return {
          ready: true,
          currentUrl: this.page.url(),
          headless: this.headless
        };
      }
    }

    this.isLaunching = true;
    try {
      await this.closeSession();

      this.headless = Boolean(headless);
      this.activeSessionId = `sandbox_${Date.now()}`;

      console.log(`[Sandbox] Launching Chromium (headless: ${this.headless})...`);

      const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
      if (antiDetection) {
        launchArgs.push('--disable-blink-features=AutomationControlled');
      }

      this.browser = await chromium.launch({
        headless: this.headless,
        args: launchArgs
      });

      const contextOptions = {
        viewport: { width: 1280, height: 720 }
      };

      if (antiDetection) {
        contextOptions.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        contextOptions.extraHTTPHeaders = {
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"'
        };
      }

      this.context = await this.browser.newContext(contextOptions);

      if (antiDetection) {
        await this.context.addInitScript(() => {
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

      this.page = await this.context.newPage();
      await this.page.goto('about:blank');

      // Attach CDP session for real-time screencast streaming
      await this.startScreencast();

      console.log(`[Sandbox] Browser initialized successfully.`);
      return {
        ready: true,
        currentUrl: this.page.url(),
        headless: this.headless
      };
    } finally {
      this.isLaunching = false;
    }
  }

  /**
   * Starts CDP screencast on the current page
   */
  async startScreencast() {
    try {
      if (this.cdpSession) {
        try { await this.cdpSession.detach(); } catch (_) {}
      }

      this.cdpSession = await this.page.context().newCDPSession(this.page);
      await this.cdpSession.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 75,
        maxWidth: 1280,
        maxHeight: 720,
        everyNthFrame: 1
      });

      this.cdpSession.on('Page.screencastFrame', async ({ data, sessionId }) => {
        try {
          await this.cdpSession.send('Page.screencastFrameAck', { sessionId });
        } catch (_) {}

        const buffer = Buffer.from(data, 'base64');
        this.lastFrame = buffer;

        // Broadcast to all active HTTP MJPEG streams
        for (const sendFrame of this.screencastClients) {
          try {
            sendFrame(buffer);
          } catch (err) {
            // Client probably disconnected
          }
        }
      });

      // Capture initial frame
      const initialScreenshot = await this.page.screenshot({ type: 'jpeg', quality: 75 });
      this.lastFrame = initialScreenshot;
    } catch (err) {
      console.error('[Sandbox] Failed to attach screencast:', err.message);
    }
  }

  /**
   * Registers a client to receive MJPEG streaming frames
   */
  addStreamClient(res) {
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Connection': 'close',
      'Expires': '0'
    });

    const sendFrame = (jpegBuffer) => {
      try {
        res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpegBuffer.length}\r\n\r\n`);
        res.write(jpegBuffer);
        res.write('\r\n');
      } catch (_) {}
    };

    // Send immediate latest frame so UI doesn't wait
    if (this.lastFrame) {
      sendFrame(this.lastFrame);
    }

    this.screencastClients.add(sendFrame);

    res.on('close', () => {
      this.screencastClients.delete(sendFrame);
    });
  }

  /**
   * Executes a single action step against the live browser
   */
  async executeStep(step, parameters = {}, secrets = {}) {
    if (!this.page || this.page.isClosed()) {
      await this.initSession({ headless: this.headless });
    }

    // Resolve secrets: use test secrets provided by user in Sandbox;
    // if a secret is blank or masked and step belongs to a block, fallback to DB vault
    const resolvedSecrets = { ...secrets };
    const targetBlockId = step.sourceBlockId || step.blockId;
    if (targetBlockId) {
      try {
        const storedBlock = db.getBlock(targetBlockId, false);
        if (storedBlock && storedBlock.secrets) {
          for (const [key, encVal] of Object.entries(storedBlock.secrets)) {
            if (!resolvedSecrets[key] || resolvedSecrets[key] === '********') {
              try {
                resolvedSecrets[key] = decrypt(encVal);
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        console.warn(`[Sandbox] Falha ao carregar secrets do bloco ${targetBlockId}:`, err.message);
      }
    }

    const startTime = Date.now();
    const resultLog = {
      type: step.type,
      startedAt: new Date().toISOString(),
      duration: 0,
      data: null,
      error: null,
      skipped: false,
      currentUrl: this.page ? this.page.url() : 'about:blank'
    };

    try {
      console.log(`[Sandbox] Executing step: ${step.type}`);

      let actionType = (step.type || '').trim().toLowerCase();
      if (actionType === 'take_screenshot') actionType = 'screenshot';
      if (actionType === 'press_key') actionType = 'keypress';
      if (actionType === 'dynamic_script') actionType = 'eval';

      switch (actionType) {
        case 'navigate': {
          const rawUrl = step.url || '';
          const url = resolveText(rawUrl, resolvedSecrets, parameters);
          if (!url) throw new Error('A ação Navegar requer uma URL válida.');
          console.log(`[Sandbox] Navigating to: ${url}`);
          await this.page.goto(url, { waitUntil: 'load', timeout: 30000 });
          resultLog.data = { message: `Navegou com sucesso para ${url}` };
          break;
        }

        case 'click': {
          const selector = resolveText(step.selector, resolvedSecrets, parameters);
          if (!selector) throw new Error('A ação Clicar requer um seletor.');
          const pwSelector = getPlaywrightSelector(selector, step.selector_type);
          console.log(`[Sandbox] Clicking: ${pwSelector}`);
          const locator = this.page.locator(pwSelector).first();
          await locator.waitFor({ state: 'visible', timeout: 15000 });
          if (step.click_type === 'double') {
            await locator.dblclick({ timeout: 10000 });
          } else {
            await locator.click({ timeout: 10000 });
          }
          resultLog.data = { message: `Elemento clicado: ${pwSelector}` };
          break;
        }

        case 'type': {
          const selector = resolveText(step.selector, resolvedSecrets, parameters);
          if (!selector) throw new Error('A ação Digitar requer um seletor.');
          const pwSelector = getPlaywrightSelector(selector, step.selector_type);
          const rawText = step.text || '';
          const textToType = resolveText(rawText, resolvedSecrets, parameters);
          console.log(`[Sandbox] Typing in ${pwSelector}: ${rawText.includes('{{secret') ? '********' : textToType}`);
          const locator = this.page.locator(pwSelector).first();
          await locator.waitFor({ state: 'visible', timeout: 15000 });
          await locator.fill(textToType, { timeout: 10000 });
          resultLog.data = { message: `Texto digitado em ${pwSelector}` };
          break;
        }

        case 'select': {
          const selector = resolveText(step.selector, resolvedSecrets, parameters);
          if (!selector) throw new Error('A ação Selecionar requer um seletor.');
          const pwSelector = getPlaywrightSelector(selector, step.selector_type);
          const val = resolveText(step.value || '', resolvedSecrets, parameters);
          console.log(`[Sandbox] Selecting in ${pwSelector}: ${val}`);
          const locator = this.page.locator(pwSelector).first();
          await locator.waitFor({ state: 'visible', timeout: 15000 });
          await locator.selectOption(val, { timeout: 10000 });
          resultLog.data = { message: `Opção selecionada: ${val}` };
          break;
        }

        case 'wait': {
          const condition = step.condition || 'load';
          const timeout = (parseInt(step.timeout, 10) || 10) * 1000;
          console.log(`[Sandbox] Waiting condition: ${condition} (timeout ${timeout}ms)`);

          if (condition === 'load') {
            await this.page.waitForLoadState('load', { timeout });
          } else if (condition === 'networkidle') {
            await this.page.waitForLoadState('networkidle', { timeout });
          } else if (condition === 'visible') {
            const selector = resolveText(step.selector, resolvedSecrets, parameters);
            if (!selector) throw new Error('A espera por elemento visível requer um seletor.');
            const pwSelector = getPlaywrightSelector(selector, step.selector_type);
            await this.page.locator(pwSelector).first().waitFor({ state: 'visible', timeout });
          }
          resultLog.data = { message: `Espera concluída (${condition})` };
          break;
        }

        case 'keypress': {
          const key = resolveText(step.key || 'Enter', resolvedSecrets, parameters);
          console.log(`[Sandbox] Keypress: ${key}`);
          await this.page.keyboard.press(key);
          resultLog.data = { message: `Tecla pressionada: ${key}` };
          break;
        }

        case 'extract_html': {
          console.log(`[Sandbox] Extracting HTML content`);
          const html = await this.page.content();
          resultLog.data = { html, length: html.length, message: `HTML capturado (${html.length} caracteres)` };
          break;
        }

        case 'list_elements': {
          const query = resolveText(step.query_selector, resolvedSecrets, parameters);
          if (!query) throw new Error('A ação Listar Elementos requer um query_selector.');
          const pwSelector = getPlaywrightSelector(query, step.selector_type || 'css');
          console.log(`[Sandbox] Listing elements: ${pwSelector}`);
          const locator = this.page.locator(pwSelector);
          const count = await locator.count();
          const elements = [];
          const maxToFetch = Math.min(count, 50);
          for (let i = 0; i < maxToFetch; i++) {
            const el = locator.nth(i);
            const text = (await el.innerText().catch(() => '')) || '';
            const html = (await el.evaluate(node => node.outerHTML).catch(() => '')) || '';
            elements.push({ index: i, text: text.trim(), html: html.substring(0, 300) });
          }
          resultLog.data = { count, items: elements, message: `${count} nós encontrados para ${pwSelector}` };
          break;
        }

        case 'conditional_if': {
          const selector = resolveText(step.selector_exists, resolvedSecrets, parameters);
          if (!selector) throw new Error('A condição requer um seletor.');
          const pwSelector = getPlaywrightSelector(selector, step.selector_type);
          const exists = (await this.page.locator(pwSelector).count()) > 0;
          resultLog.data = { conditionMet: exists, message: exists ? `Elemento existe (${pwSelector})` : `Elemento NÃO encontrado (${pwSelector})` };
          break;
        }

        case 'eval': {
          const script = resolveText(step.script, resolvedSecrets, parameters);
          if (!script) throw new Error("O script da etapa 'eval' não foi fornecido.");
          console.log(`[Sandbox] Evaluating script: ${script.substring(0, 60)}...`);
          const output = await this.page.evaluate(script);

          resultLog.data = {
            result: output !== undefined ? output : null,
            returnValue: output !== undefined ? output : null,
            hasOutput: output !== undefined,
            message: output !== undefined
              ? (typeof output === 'object' && output !== null
                  ? `Retorno: ${Array.isArray(output) ? `Array [${output.length}]` : 'Objeto'}`
                  : `Retorno: ${String(output).substring(0, 100)}`)
              : 'Executado sem retorno explícito.'
          };

          // If output_file is configured, also save to disk
          const rawOutputFile = (step.output_file || '').trim();
          if (rawOutputFile) {
            const resolvedFilename = resolveText(rawOutputFile, resolvedSecrets, parameters).trim();
            if (resolvedFilename) {
              const safeFilename = path.basename(resolvedFilename);
              const uniqueFilename = `sandbox_${safeFilename}`;
              const filePath = path.join(DOWNLOADS_DIR, uniqueFilename);

              let fileContent = '';
              if (typeof output === 'string') {
                fileContent = output;
              } else if (output !== undefined && output !== null) {
                fileContent = typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output);
              }

              fs.writeFileSync(filePath, fileContent, 'utf-8');
              resultLog.data.downloadPath = `/downloads/${uniqueFilename}`;
              resultLog.data.downloadName = safeFilename;
            }
          }
          break;
        }

        case 'screenshot': {
          const filename = `sandbox_screenshot_${Date.now()}.png`;
          const filePath = path.join(SCREENSHOTS_DIR, filename);
          await this.page.screenshot({ path: filePath, fullPage: true });
          resultLog.data = {
            screenshotPath: `/screenshots/${filename}`,
            message: 'Screenshot capturada com sucesso'
          };
          break;
        }

        case 'manual_interaction':
        case 'user_interaction':
        case 'interacao_manual': {
          const instruction = resolveText(
            step.instruction || step.message || 'Por favor, realize as ações necessárias com o mouse e teclado no navegador e depois continue.',
            resolvedSecrets,
            parameters
          );
          resultLog.data = {
            isManualInteraction: true,
            instruction,
            message: 'Ação de interação manual executada no Sandbox.',
            note: this.headless
              ? 'Dica: Alterne para o modo "Headed (Visual)" no topo do Studio caso queira interagir diretamente na janela do sistema operacional.'
              : 'Janela do Chromium aberta na sua área de trabalho para interação direta.'
          };
          break;
        }

        default: {
          console.warn(`[Sandbox] Ação "${step.type}" não suportada ou ignorada no Sandbox Studio.`);
          resultLog.skipped = true;
          resultLog.data = {
            skipped: true,
            ignored: true,
            message: `Ação "${step.type}" não suportada no Sandbox (ignorada com sucesso).`
          };
          break;
        }
      }

      resultLog.duration = Math.max(1, Math.round(Date.now() - startTime));
      resultLog.success = true;
      resultLog.currentUrl = this.page ? this.page.url() : 'about:blank';
      resultLog.title = this.page ? await this.page.title().catch(() => '') : '';

      return resultLog;
    } catch (err) {
      console.error(`[Sandbox] Step execution failed:`, err.message);
      resultLog.duration = Math.max(1, Math.round(Date.now() - startTime));
      resultLog.success = false;
      resultLog.error = err.message;
      resultLog.currentUrl = this.page ? this.page.url() : 'about:blank';
      return resultLog;
    }
  }

  /**
   * Resets browser session to clean state (about:blank)
   */
  async resetSession() {
    if (!this.browser || !this.context) {
      return this.initSession({ headless: this.headless });
    }

    try {
      console.log(`[Sandbox] Resetting browser session...`);
      // Clear cookies and permissions
      await this.context.clearCookies();
      await this.context.clearPermissions();

      if (this.page && !this.page.isClosed()) {
        await this.page.goto('about:blank', { waitUntil: 'load', timeout: 15000 });
      } else {
        this.page = await this.context.newPage();
        await this.page.goto('about:blank');
        await this.startScreencast();
      }

      // Update screencast frame
      const initialScreenshot = await this.page.screenshot({ type: 'jpeg', quality: 75 }).catch(() => null);
      if (initialScreenshot) {
        this.lastFrame = initialScreenshot;
        for (const client of this.screencastClients) {
          try { client(initialScreenshot); } catch (_) {}
        }
      }

      return {
        ready: true,
        currentUrl: 'about:blank',
        message: 'Navegador resetado com sucesso para aba em branco.'
      };
    } catch (err) {
      console.error('[Sandbox] Failed to reset session, re-initializing:', err.message);
      return this.initSession({ headless: this.headless });
    }
  }

  /**
   * Gets current state of sandbox session
   */
  async getState() {
    const isReady = !!(this.page && !this.page.isClosed());
    let currentUrl = 'about:blank';
    let title = '';

    if (isReady) {
      try {
        currentUrl = this.page.url();
        title = await this.page.title();
      } catch (_) {}
    }

    return {
      isReady,
      currentUrl,
      title,
      headless: this.headless
    };
  }

  /**
   * Retrieves the current HTML source code and page metadata
   */
  async getPageSource() {
    if (!this.page || this.page.isClosed()) {
      return { html: '', url: 'about:blank', title: '', isReady: false, lines: 0, length: 0 };
    }
    try {
      const html = await this.page.content();
      const url = this.page.url();
      const title = await this.page.title().catch(() => '');
      return {
        html,
        url,
        title,
        isReady: true,
        length: html.length,
        lines: html.split('\n').length
      };
    } catch (err) {
      console.error('[Sandbox] Failed to retrieve page source:', err);
      return {
        html: '',
        url: this.page ? this.page.url() : 'about:blank',
        title: '',
        isReady: false,
        lines: 0,
        length: 0,
        error: err.message
      };
    }
  }

  /**
   * Closes the sandbox browser
   */
  async closeSession() {
    if (this.cdpSession) {
      try { await this.cdpSession.detach(); } catch (_) {}
      this.cdpSession = null;
    }
    if (this.context) {
      try { await this.context.close(); } catch (_) {}
      this.context = null;
    }
    if (this.browser) {
      try { await this.browser.close(); } catch (_) {}
      this.browser = null;
    }
    this.page = null;
    this.lastFrame = null;
  }
}

export const sandboxManager = new SandboxManager();
