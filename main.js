const {
  app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, dialog, powerMonitor, screen, net
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

const APP_NAME = 'Rano & Repos & Sport';
app.setAppUserModelId('mg.sitraka.ranorepossport');

let win = null;
let tray = null;
let quitting = false;
let sys = { closeToTray: true, bounds: null, maximized: false, trayNoticeShown: false };
const startHidden = process.argv.includes('--hidden');

// ---------- Configuration ----------
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  } catch (e) {
    return { firebase: {}, authPage: '', repo: '' };
  }
}

function sysFile() {
  return path.join(app.getPath('userData'), 'system.json');
}
function loadSys() {
  try {
    const s = JSON.parse(fs.readFileSync(sysFile(), 'utf8'));
    sys = Object.assign(sys, s);
  } catch (e) { /* premier lancement */ }
}
function saveSys() {
  try {
    fs.writeFileSync(sysFile(), JSON.stringify(sys));
  } catch (e) { /* ignoré */ }
}

function loginEnabled() {
  try {
    return app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin;
  } catch (e) {
    return false;
  }
}

// ---------- Fenêtre ----------
function boundsVisible(b) {
  if (!b || typeof b.width !== 'number') return false;
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width - 80 && b.x + b.width > a.x + 80 && b.y < a.y + a.height - 80 && b.y + b.height > a.y;
  });
}

function showWin() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  const b = boundsVisible(sys.bounds) ? sys.bounds : null;
  win = new BrowserWindow({
    width: b ? b.width : 1120,
    height: b ? b.height : 760,
    x: b ? b.x : undefined,
    y: b ? b.y : undefined,
    minWidth: 700,
    minHeight: 480,
    show: false,
    backgroundColor: '#0A1020',
    title: APP_NAME,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      spellcheck: false
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    if (startHidden) return;
    if (sys.maximized) win.maximize();
    win.show();
  });

  const remember = () => {
    if (!win || win.isDestroyed() || win.isMinimized()) return;
    sys.maximized = win.isMaximized();
    if (!win.isMaximized() && !win.isFullScreen()) sys.bounds = win.getBounds();
  };
  win.on('resize', remember);
  win.on('move', remember);

  win.on('close', (e) => {
    remember();
    saveSys();
    if (!quitting && sys.closeToTray) {
      e.preventDefault();
      win.hide();
      if (!sys.trayNoticeShown && tray) {
        sys.trayNoticeShown = true;
        saveSys();
        try {
          tray.displayBalloon({
            title: APP_NAME,
            content: 'L\'application continue en arrière-plan. Les rappels restent actifs. Clic droit sur l\'icône pour quitter.'
          });
        } catch (err) { /* ignoré */ }
      }
    }
  });

  win.on('focus', () => {
    try { win.flashFrame(false); } catch (e) { /* ignoré */ }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
}

function createTray() {
  let img = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip(APP_NAME);
  const go = (view) => () => {
    showWin();
    if (win) win.webContents.send('navigate', view);
  };
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir ' + APP_NAME, click: showWin },
    { type: 'separator' },
    { label: 'Repos', click: go('repos') },
    { label: 'Eau', click: go('water') },
    { label: 'Sport', click: go('sport') },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]));
  tray.on('click', showWin);
}

// ---------- Connexion Google (navigateur + retour local) ----------
function successPage(ok, msg) {
  const color = ok ? '#2EE6B6' : '#FF6B6B';
  return '<!doctype html><html lang="fr"><meta charset="utf-8"><title>' + APP_NAME + '</title>' +
    '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A1020;color:#E8EEF9;font-family:Segoe UI,system-ui,sans-serif">' +
    '<div style="text-align:center;padding:32px;max-width:420px"><div style="font-size:56px;color:' + color + '">' + (ok ? '✓' : '!') + '</div>' +
    '<h1 style="font-size:22px;margin:12px 0">' + msg + '</h1>' +
    '<p style="color:#A9B6D0">Vous pouvez fermer cet onglet et revenir à l\'application.</p></div></body></html>';
}

let authBusy = false;
function googleSignIn() {
  const cfg = readConfig();
  if (!cfg.authPage) return Promise.resolve({ error: 'Page de connexion non configurée (config.json).' });
  if (authBusy) return Promise.resolve({ error: 'Une connexion est déjà en cours.' });
  authBusy = true;
  const state = crypto.randomBytes(16).toString('hex');

  return new Promise((resolve) => {
    let done = false;
    let server = null;
    let timer = null;
    const finish = (result) => {
      if (done) return;
      done = true;
      authBusy = false;
      clearTimeout(timer);
      try { if (server) server.close(); } catch (e) { /* ignoré */ }
      resolve(result);
      showWin();
    };

    server = http.createServer((req, res) => {
      let u;
      try {
        u = new URL(req.url, 'http://127.0.0.1');
      } catch (e) {
        res.writeHead(400);
        return res.end();
      }
      if (u.pathname !== '/cb') {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      if (u.searchParams.get('state') !== state) {
        res.end(successPage(false, 'Connexion refusée (état invalide)'));
        return;
      }
      const error = u.searchParams.get('error');
      const idToken = u.searchParams.get('idToken');
      const accessToken = u.searchParams.get('accessToken');
      if (error || (!idToken && !accessToken)) {
        res.end(successPage(false, 'La connexion a échoué'));
        finish({ error: error || 'Connexion annulée.' });
        return;
      }
      res.end(successPage(true, 'Connexion réussie'));
      finish({ idToken: idToken || null, accessToken: accessToken || null });
    });

    server.on('error', () => finish({ error: 'Impossible de démarrer la connexion locale.' }));
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const cfgB64 = Buffer.from(JSON.stringify(cfg.firebase || {})).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const url = cfg.authPage + '#port=' + port + '&state=' + state + '&cfg=' + cfgB64;
      shell.openExternal(url).catch(() => finish({ error: 'Impossible d\'ouvrir le navigateur.' }));
      timer = setTimeout(() => finish({ error: 'Délai dépassé. Réessayez.' }), 5 * 60 * 1000);
    });
  });
}

// ---------- IPC ----------
function registerIpc() {
  ipcMain.handle('config', () => {
    const c = readConfig();
    return Object.assign({}, c, { version: app.getVersion() });
  });

  ipcMain.handle('auth:google', () => googleSignIn());

  ipcMain.handle('open-external', (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url);
    return null;
  });

  ipcMain.handle('sys:get', () => ({
    closeToTray: sys.closeToTray,
    autoLaunch: loginEnabled(),
    packaged: app.isPackaged
  }));

  ipcMain.handle('sys:set', (_e, patch) => {
    if (patch && typeof patch.closeToTray === 'boolean') sys.closeToTray = patch.closeToTray;
    if (patch && typeof patch.autoLaunch === 'boolean' && app.isPackaged) {
      try {
        app.setLoginItemSettings({ openAtLogin: patch.autoLaunch, args: ['--hidden'] });
      } catch (e) { /* ignoré */ }
    }
    saveSys();
    return { closeToTray: sys.closeToTray, autoLaunch: loginEnabled(), packaged: app.isPackaged };
  });

  ipcMain.handle('export', async (_e, name, text) => {
    const r = await dialog.showSaveDialog(win, {
      title: 'Exporter mes données',
      defaultPath: path.join(app.getPath('documents'), String(name || 'export.json')),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    fs.writeFileSync(r.filePath, String(text), 'utf8');
    return { path: r.filePath };
  });

  ipcMain.handle('update:check', async () => {
    const cfg = readConfig();
    if (!cfg.repo) return { error: 'Dépôt non configuré.' };
    try {
      const r = await net.fetch('https://api.github.com/repos/' + cfg.repo + '/releases/latest', {
        headers: { 'User-Agent': 'RanoReposSport', Accept: 'application/vnd.github+json' }
      });
      if (!r.ok) return { error: 'Impossible de vérifier (code ' + r.status + ').' };
      const j = await r.json();
      return {
        version: String(j.tag_name || '').replace(/^v/i, ''),
        url: 'https://github.com/' + cfg.repo + '/releases/latest/download/RanoReposSport-Setup.exe',
        page: j.html_url || ''
      };
    } catch (e) {
      return { error: 'Pas de connexion internet.' };
    }
  });

  ipcMain.on('focus', showWin);

  ipcMain.on('alert', (_e, front) => {
    if (!win) return;
    if (front) {
      showWin();
      try {
        win.setAlwaysOnTop(true);
        setTimeout(() => {
          if (win && !win.isDestroyed()) win.setAlwaysOnTop(false);
        }, 1500);
      } catch (e) { /* ignoré */ }
    } else if (!win.isFocused()) {
      try { win.flashFrame(true); } catch (e) { /* ignoré */ }
    }
  });

  ipcMain.on('tray:state', (_e, text) => {
    if (tray) tray.setToolTip(text ? APP_NAME + '\n' + text : APP_NAME);
  });
}

// ---------- Démarrage ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWin);

  app.on('before-quit', () => {
    quitting = true;
    saveSys();
  });

  app.on('window-all-closed', () => {
    if (!sys.closeToTray || quitting) app.quit();
  });

  app.whenReady().then(() => {
    loadSys();
    registerIpc();
    createWindow();
    createTray();
    powerMonitor.on('lock-screen', () => {
      if (win && !win.isDestroyed()) win.webContents.send('lock');
    });
    powerMonitor.on('resume', () => {
      if (win && !win.isDestroyed()) win.webContents.send('resume');
    });
  });
}
