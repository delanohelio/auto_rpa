import { spawn, spawnSync } from 'child_process';
import fs from 'fs';

let xvfbProcess = null;

/**
 * Checks if a graphical display server (X11 / Wayland / macOS / Windows) is accessible
 */
export function isDisplayAvailable() {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    return true; // macOS and Windows desktops always have windowing server
  }

  if (process.platform === 'linux') {
    return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  }

  return true;
}

/**
 * Ensures an active X11 display exists on Linux.
 * If DISPLAY is missing, tries to spawn Xvfb automatically if installed.
 * Returns true if a display is now available, false if headed mode cannot run physically.
 */
export function ensureDisplayServer() {
  if (isDisplayAvailable()) {
    return true;
  }

  if (process.platform === 'linux') {
    // Check if Xvfb binary exists
    let hasXvfb = false;
    try {
      if (fs.existsSync('/usr/bin/Xvfb') || fs.existsSync('/usr/local/bin/Xvfb')) {
        hasXvfb = true;
      } else {
        const check = spawnSync('which', ['Xvfb']);
        hasXvfb = check.status === 0;
      }
    } catch (_) {}

    if (hasXvfb && !xvfbProcess) {
      try {
        const displayNum = ':99';
        console.log(`[Display] Iniciando servidor virtual Xvfb na porta ${displayNum}...`);
        
        xvfbProcess = spawn('Xvfb', [
          displayNum,
          '-screen', '0', '1280x1024x24',
          '-ac',
          '+extension', 'GLX',
          '+render',
          '-noreset'
        ], {
          detached: true,
          stdio: 'ignore'
        });

        xvfbProcess.unref();
        process.env.DISPLAY = displayNum;

        // Clean up on exit
        process.on('exit', () => {
          if (xvfbProcess && !xvfbProcess.killed) {
            try { xvfbProcess.kill('SIGKILL'); } catch (_) {}
          }
        });

        console.log(`[Display] Xvfb iniciado com sucesso em DISPLAY=${displayNum}. Modo Headed habilitado via framebuffer virtual.`);
        return true;
      } catch (err) {
        console.warn('[Display] Falha ao iniciar processo Xvfb em segundo plano:', err.message);
      }
    }
  }

  return false;
}

/**
 * Detects if a Chromium launch error was caused by missing X11 server or $DISPLAY
 */
export function isX11LaunchError(error) {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : (error.message || error.stack || '');
  return (
    msg.includes('Missing X server') ||
    msg.includes('XServer running') ||
    msg.includes('ozone_platform_x11') ||
    msg.includes('Missing X server or $DISPLAY') ||
    msg.includes('The platform failed to initialize') ||
    (msg.includes('Target page, context or browser has been closed') && msg.includes('DISPLAY'))
  );
}
