'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const BACKEND_PORT = parseInt(process.env.LMA_BACKEND_PORT || '3001', 10);
const ENGINE_PORT = parseInt(process.env.LMA_ENGINE_PORT || '8002', 10);
const VIDEO_PORT = parseInt(process.env.LMA_VIDEO_PORT || '8011', 10);

function resourcesPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'resources')
    : path.join(__dirname, '..', 'resources');
}

function dataDir() {
  const dir = path.join(app.getPath('userData'));
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  return dir;
}

function findEnginePython() {
  if (process.env.LMA_NO_ENGINE === '1') return null;
  const cfgPath = path.join(app.getPath('userData'), 'engine.json');
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (_) {}
  const candidates = [
    cfg.aceStepPath,
    process.env.ACESTEP_PATH,
    path.join('C:', 'LesargeMusicAI', 'ACE-Step-1.5'),
    path.join(resourcesPath(), 'engine'),
  ].filter(Boolean);
  for (const base of candidates) {
    if (!fs.existsSync(path.join(base, 'acestep'))) continue;
    const py = path.join(base, '.venv', 'Scripts', 'python.exe');
    return { base, python: fs.existsSync(py) ? py : 'python' };
  }
  return null;
}

function portableNode() {
  const exe = path.join(resourcesPath(), 'node', 'node.exe');
  return fs.existsSync(exe) ? exe : (process.execPath.includes('electron') ? null : process.execPath);
}

let mainWindow = null;
let backendProc = null;
let engineProc = null;
let videoProc = null;
let engineState = { found: false, path: null, starting: false, log: [] };

function engineStatus() {
  return { ...engineState };
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  engineState.log.push(line);
  if (engineState.log.length > 200) engineState.log.shift();
  console.log(line);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:log', line);
  }
}

function waitForHttp(url, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tryOnce = () => {
      fetch(url, { signal: AbortSignal.timeout(2000) })
        .then((r) => r.text())
        .then((body) => {
          if (body && body.length > 0) resolve(true);
          else if (Date.now() - started > timeoutMs) resolve(false);
          else setTimeout(tryOnce, 500);
        })
        .catch(() => {
          if (Date.now() - started > timeoutMs) resolve(false);
          else setTimeout(tryOnce, 500);
        });
    };
    tryOnce();
  });
}

function startBackend(env) {
  const node = portableNode();
  const server = path.join(resourcesPath(), 'server', 'dist', 'index.js');
  if (!node || !fs.existsSync(server)) {
    log(`BACKEND MISSING node=${node} server=${server}`);
    return null;
  }
  const proc = spawn(node, [server], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  proc.stdout.on('data', (d) => log(`[backend] ${d.toString().trim()}`));
  proc.stderr.on('data', (d) => log(`[backend:err] ${d.toString().trim()}`));
  proc.on('exit', (code) => log(`backend exited (${code})`));
  return proc;
}

function startVideoService(engine, dir) {
  if (process.env.LMA_NO_VIDEO === '1') return null;
  if (!engine) return null;
  const script = path.join('C:', 'LesargeMusicAI', 'lesarge music', 'engines', 'video', 'video_service.py');
  const bundled = path.join(resourcesPath(), 'video', 'video_service.py');
  const py = fs.existsSync(bundled) ? engine.python : (fs.existsSync(script) ? engine.python : null);
  if (!py) {
    log('video service script not found');
    return null;
  }
  const env = {
    ...process.env,
    VIDEO_API_PORT: String(VIDEO_PORT),
    VIDEO_OUTPUT_DIR: path.join(dir, 'video-out'),
  };
  const proc = spawn(py, [fs.existsSync(bundled) ? bundled : script, '--port', String(VIDEO_PORT)], {
    cwd: path.dirname(script),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  proc.stdout.on('data', (d) => log(`[video] ${d.toString().trim()}`));
  proc.stderr.on('data', (d) => log(`[video:err] ${d.toString().trim()}`));
  proc.on('exit', (code) => log(`video service exited (${code})`));
  return proc;
}

function startEngine(engine) {
  if (process.env.LMA_NO_ENGINE === '1') return;
  if (engineState.starting) return;
  engineState.starting = true;
  engineState.found = true;
  engineState.path = engine.base;
  log(`engine found at ${engine.base}`);
  const env = { ...process.env, ACESTEP_API_PORT: String(ENGINE_PORT) };
  const proc = spawn(engine.python, ['-m', 'acestep.api_server', '--port', String(ENGINE_PORT)], {
    cwd: engine.base,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  proc.stdout.on('data', (d) => log(`[engine] ${d.toString().trim()}`));
  proc.stderr.on('data', (d) => log(`[engine:err] ${d.toString().trim()}`));
  proc.on('exit', (code) => {
    engineState.starting = false;
    log(`engine exited (${code})`);
    engineProc = null;
  });
  engineProc = proc;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f1115',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
  return mainWindow;
}

async function boot() {
  const dir = dataDir();
  const engine = findEnginePython();
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(BACKEND_PORT),
    DATABASE_PATH: path.join(dir, 'data', 'acestep.db'),
    AUDIO_DIR: path.join(dir, 'audio'),
    ACESTEP_API_URL: `http://localhost:${ENGINE_PORT}`,
    VIDEO_API_URL: `http://localhost:${VIDEO_PORT}`,
    JWT_SECRET: crypto.randomBytes(24).toString('hex'),
    FRONTEND_URL: `http://localhost:${BACKEND_PORT}`,
  };
  if (engine) {
    env.ACESTEP_PATH = engine.base;
    env.DATASETS_DIR = path.join(engine.base, 'datasets');
    env.DATASETS_UPLOADS_DIR = path.join(engine.base, 'datasets', 'uploads');
  }
  const win = createWindow();
  backendProc = startBackend(env);
  if (engine) startEngine(engine);
  videoProc = startVideoService(engine, dir);

  const up = await waitForHttp(`http://localhost:${BACKEND_PORT}`, 45000);
  if (!up) {
    log('backend did not become ready within 45s');
    dialog.showMessageBox(win, {
      type: 'error',
      title: 'Startup failed',
      message: 'The Lesarge Music AI backend failed to start.',
      detail: engineState.log.join('\n'),
    });
    return;
  }
  win.loadURL(`http://localhost:${BACKEND_PORT}`);
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('app:engine', engineStatus());
  });
}

app.whenReady().then(boot);
initAutoUpdater();

ipcMain.handle('engine:status', () => engineStatus());

ipcMain.handle('engine:install', async (_e) => {
  const res = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Cancel', 'Install AI Engine'],
    defaultId: 1,
    title: 'Install AI Engine',
    message: 'No ACE-Step engine was found on this computer.',
    detail:
      'The AI engine (~9 GB of models) is required for generation.\n' +
      'Install the engine at C:\\LesargeMusicAI\\ACE-Step-1.5 first, or pick a setup script.',
  });
  if (res.response !== 1) return { status: 'cancelled' };
  const setup = path.join(resourcesPath(), 'scripts', 'engine-setup.ps1');
  if (!fs.existsSync(setup)) {
    dialog.showErrorBox('Missing setup script', setup);
    return { status: 'missing-script' };
  }
  spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', setup], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  }).unref();
  return { status: 'launched' };
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (backendProc) backendProc.kill();
  if (engineProc) engineProc.kill();
  if (videoProc) videoProc.kill();
});

// ---------------------------------------------------------------------------
// Auto-update (electron-updater)
// ---------------------------------------------------------------------------
let autoUpdater = null;
let updateChecked = false;

function initAutoUpdater() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater: au } = require('electron-updater');
    autoUpdater = au;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    const feed = process.env.LMA_UPDATE_URL || 'https://lesarge.ch/music-updates';
    autoUpdater.setFeedURL({ provider: 'generic', url: feed, channel: 'latest' });

    autoUpdater.on('update-available', (info) => {
      log(`update available: ${info.version}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:update', { state: 'available', version: info.version });
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          buttons: ['Update now', 'Later'],
          defaultId: 0,
          title: 'Update available',
          message: `A new version (${info.version}) is available.`,
          detail: 'Download and install it now?',
        }).then((r) => {
          if (r.response === 0) autoUpdater.downloadUpdate();
        });
      }
    });
    autoUpdater.on('update-downloaded', () => {
      log('update downloaded');
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          title: 'Update ready',
          message: 'Update downloaded. Restart to install?',
        }).then((r) => {
          if (r.response === 0) autoUpdater.quitAndInstall();
        });
      }
    });
    autoUpdater.on('error', (err) => log(`update error: ${err && err.message}`));

    // Check a few seconds after launch (backend boot first)
    setTimeout(() => {
      if (!updateChecked) {
        updateChecked = true;
        autoUpdater.checkForUpdates().catch((e) => log(`update check failed: ${e.message}`));
      }
    }, 8000);
  } catch (err) {
    log(`auto-update unavailable: ${err && err.message}`);
  }
}

ipcMain.handle('update:check', async () => {
  if (!autoUpdater) return { state: 'unavailable' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { state: 'checked', version: result && result.updateInfo ? result.updateInfo.version : null };
  } catch (err) {
    return { state: 'error', error: err.message };
  }
});
