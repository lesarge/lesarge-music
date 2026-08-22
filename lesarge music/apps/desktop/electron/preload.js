'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lesargeApp', {
  engineStatus: () => ipcRenderer.invoke('engine:status'),
  engineInstall: () => ipcRenderer.invoke('engine:install'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  onLog: (cb) => {
    ipcRenderer.on('app:log', (_e, line) => cb(line));
  },
  onEngine: (cb) => {
    ipcRenderer.on('app:engine', (_e, s) => cb(s));
  },
  onUpdate: (cb) => {
    ipcRenderer.on('app:update', (_e, s) => cb(s));
  },
});
