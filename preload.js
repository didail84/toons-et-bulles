'use strict';
/* Pont entre la page et l'ordinateur : seulement les quelques fonctions dont l'appli a besoin. */
const {contextBridge, ipcRenderer} = require('electron');

const arg = process.argv.find((a) => a.startsWith('--desk-api='));
const name = arg ? arg.slice('--desk-api='.length) : '';

if (/^[A-Za-z_$][\w$]*$/.test(name)) {
  contextBridge.exposeInMainWorld(name, {
    fetchJson: (url) => ipcRenderer.invoke('desk:fetchJson', url),
    readFile: (p) => ipcRenderer.invoke('desk:readFile', p),
    writeFile: (p, data) => ipcRenderer.invoke('desk:writeFile', p, data),
    chooseFolder: () => ipcRenderer.invoke('desk:chooseFolder'),
    pageShow: (url) => ipcRenderer.invoke('desk:pageShow', url),
    pageEval: (url, code) => ipcRenderer.invoke('desk:pageEval', url, code)
  });
}
