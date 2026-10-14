'use strict';
/*
 * Application de bureau (Windows / macOS) autour de la page HTML de l'appli.
 * La page vit dans le dossier « app/ » et s'ouvre à l'adresse app://<nom>/index.html :
 * une adresse fixe, pour que la collection enregistrée (localStorage, IndexedDB)
 * soit retrouvée à chaque lancement.
 */
const {app, BrowserWindow, protocol, net, shell, ipcMain, dialog, session, systemPreferences, Menu} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const {pathToFileURL} = require('node:url');

const PKG = require('./package.json');
const CFG = PKG.desktop || {};
const SCHEME = 'app';
const HOST = CFG.host || 'local';
const APP_DIR = path.join(__dirname, 'app');
const START_URL = `${SCHEME}://${HOST}/index.html`;

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true}
}]);

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

/* ---------- Fichiers de l'appli ---------- */
function serveApp() {
  protocol.handle(SCHEME, async (req) => {
    const u = new URL(req.url);
    if (u.host !== HOST) return new Response('Introuvable', {status: 404});
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(APP_DIR, rel));
    if (!file.startsWith(APP_DIR + path.sep)) return new Response('Interdit', {status: 403});
    try {
      await fs.access(file);
      return net.fetch(pathToFileURL(file).toString());
    } catch (e) {
      return new Response('Introuvable', {status: 404});
    }
  });
}

/* ---------- Liens externes : dans le navigateur habituel ---------- */
const isAppUrl = (url) => url.startsWith(`${SCHEME}://${HOST}/`);
function openOutside(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
}
function guardWindow(w) {
  w.webContents.setWindowOpenHandler(({url}) => { openOutside(url); return {action: 'deny'}; });
  w.webContents.on('will-navigate', (ev, url) => { if (!isAppUrl(url)) { ev.preventDefault(); openOutside(url); } });
}

/* ---------- Caméra (scan des codes-barres) : seulement pour l'appli ---------- */
function setupPermissions() {
  const ses = session.defaultSession;
  const allowed = new Set(['media', 'clipboard-sanitized-write', 'fullscreen']);
  ses.setPermissionRequestHandler(async (wc, permission, cb, details) => {
    const fromApp = isAppUrl(details.requestingUrl || wc.getURL());
    if (!fromApp || !allowed.has(permission)) return cb(false);
    if (permission === 'media' && process.platform === 'darwin') {
      try { return cb(await systemPreferences.askForMediaAccess('camera')); } catch (e) { return cb(false); }
    }
    cb(true);
  });
  ses.setPermissionCheckHandler((wc, permission, origin) => allowed.has(permission) && String(origin).startsWith(`${SCHEME}://${HOST}`));

  /* Les vidéos YouTube intégrées refusent de démarrer sans page d'origine reconnue */
  ses.webRequest.onBeforeSendHeaders({urls: ['https://*.youtube-nocookie.com/*', 'https://*.youtube.com/*', 'https://*.googlevideo.com/*']}, (d, cb) => {
    const headers = d.requestHeaders;
    if (!headers.Referer && !headers.referer) headers.Referer = `https://${HOST}.app/`;
    cb({requestHeaders: headers});
  });
}

/* ---------- Fonctions réservées à l'appli installée (window.<api>) ---------- */
function setupIpc() {
  const syncName = CFG.syncFile || '';
  const checkSyncPath = (p) => {
    if (typeof p !== 'string' || !syncName || path.basename(p) !== syncName) throw new Error('Fichier non autorisé');
    return p;
  };

  ipcMain.handle('desk:fetchJson', async (ev, url) => {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new Error('Adresse non autorisée');
    const r = await net.fetch(url, {headers: {'Accept': 'application/json', 'User-Agent': `${PKG.name}/${app.getVersion()}`}});
    if (!r.ok) throw new Error('Le site a répondu ' + r.status);
    return r.json();
  });

  ipcMain.handle('desk:readFile', async (ev, p) => {
    try { return await fs.readFile(checkSyncPath(p), 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return ''; throw e; }
  });

  ipcMain.handle('desk:writeFile', async (ev, p, data) => {
    const file = checkSyncPath(p);
    const tmp = file + '.tmp-' + process.pid;
    await fs.writeFile(tmp, String(data), 'utf8');
    await fs.rename(tmp, file);
    return true;
  });

  ipcMain.handle('desk:chooseFolder', async () => {
    const r = await dialog.showOpenDialog(win, {title: 'Dossier de synchronisation', properties: ['openDirectory', 'createDirectory']});
    return r.canceled || !r.filePaths[0] ? '' : r.filePaths[0];
  });

  ipcMain.handle('desk:pageShow', async (ev, url) => {
    if (!isClaudeUrl(url)) {
      dialog.showMessageBox(win, {type: 'info', message: 'Colle d\'abord l\'adresse de ta page Claude dans Réglages › Synchronisation.'});
      return false;
    }
    const w = await claudeWindow(url);
    w.show(); w.focus();
    return true;
  });

  ipcMain.handle('desk:pageEval', async (ev, url, code) => pageEval(url, code));
}

/* ---------- Échange avec la page Claude (fenêtre cachée, connexion gardée) ---------- */
const isClaudeUrl = (u) => typeof u === 'string' && /^https:\/\/claude\.ai\//.test(u);
let claudeWin = null;
async function claudeWindow(url) {
  if (!claudeWin || claudeWin.isDestroyed()) {
    claudeWin = new BrowserWindow({
      width: 1200, height: 860, show: false, title: 'Page Claude',
      webPreferences: {partition: 'persist:claude', contextIsolation: true, sandbox: true}
    });
    claudeWin.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); claudeWin.hide(); } });
    claudeWin.webContents.setWindowOpenHandler(({url: u}) => (isClaudeUrl(u) || /accounts\.google\.com/.test(u) ? {action: 'allow'} : (openOutside(u), {action: 'deny'})));
  }
  if (claudeWin.webContents.getURL() !== url && !claudeWin.webContents.getURL().startsWith(url)) {
    await claudeWin.loadURL(url).catch(() => {});
  }
  return claudeWin;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function findSyncFrame(w, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const cur = w.webContents.getURL();
    if (/\/login|\/signin|\/magic-link/.test(cur)) return {reason: 'login'};
    for (const f of w.webContents.mainFrame.framesInSubtree) {
      try { if (await f.executeJavaScript('!!(window.CW_SYNC && window.CW_SYNC.ready)')) return {frame: f}; } catch (e) { /* cadre pas prêt */ }
    }
    await sleep(800);
  }
  return {reason: 'notfound'};
}
let evalQueue = Promise.resolve();
function pageEval(url, code) {
  const job = evalQueue.then(async () => {
    if (!isClaudeUrl(url)) return {ok: false, reason: 'notfound', message: 'adresse invalide'};
    try {
      const w = await claudeWindow(url);
      const found = await findSyncFrame(w, 45000);
      if (!found.frame) return {ok: false, reason: found.reason};
      const result = await found.frame.executeJavaScript(String(code), true);
      return {ok: true, result};
    } catch (e) {
      return {ok: false, reason: 'error', message: e && e.message ? e.message : String(e)};
    }
  });
  evalQueue = job.catch(() => {});
  return job;
}

/* ---------- Nouvelle version sur GitHub ? ---------- */
const newer = (a, b) => {
  const pa = String(a).replace(/^v/i, '').split('.').map(Number), pb = String(b).replace(/^v/i, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
};
async function checkUpdate() {
  if (!CFG.repo) return;
  try {
    const r = await net.fetch(`https://api.github.com/repos/${CFG.repo}/releases/latest`, {headers: {'Accept': 'application/vnd.github+json', 'User-Agent': PKG.name}});
    if (!r.ok) return;
    const rel = await r.json();
    if (!rel.tag_name || !newer(rel.tag_name, app.getVersion())) return;
    const {response} = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['Télécharger', 'Plus tard'], defaultId: 0, cancelId: 1,
      message: `Une nouvelle version de ${PKG.productName} est disponible (${rel.tag_name.replace(/^v/i, '')}).`,
      detail: `Tu as la version ${app.getVersion()}. Ta collection est conservée lors de la mise à jour.`
    });
    if (response === 0) shell.openExternal(rel.html_url);
  } catch (e) { /* hors ligne : on réessaiera au prochain lancement */ }
}

/* ---------- Fenêtre principale ---------- */
function createWindow() {
  const args = [];
  if (CFG.api) args.push('--desk-api=' + CFG.api);
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 380, minHeight: 500,
    title: PKG.productName, backgroundColor: CFG.background || '#111111', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, additionalArguments: args, spellcheck: true}
  });
  guardWindow(win);
  win.once('ready-to-show', () => win.show());
  win.on('page-title-updated', (e) => e.preventDefault());
  win.loadURL(START_URL);
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('before-quit', () => { app.isQuitting = true; });
app.whenReady().then(() => {
  app.setName(PKG.productName);
  /* Un accent dans le nom (« Ciné ») ne doit pas finir dans l'en-tête User-Agent : il bloquerait le chargement des fichiers */
  app.userAgentFallback = app.userAgentFallback.normalize('NFD').replace(/[^\x20-\x7E]/g, '');
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  serveApp();
  setupPermissions();
  setupIpc();
  createWindow();
  setTimeout(checkUpdate, 8000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else if (win) win.show(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
