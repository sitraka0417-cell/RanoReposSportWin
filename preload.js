const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, cb) => {
  const fn = (_e, ...args) => cb(...args);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};

contextBridge.exposeInMainWorld('api', {
  config: () => ipcRenderer.invoke('config'),
  signInGoogle: () => ipcRenderer.invoke('auth:google'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getSystem: () => ipcRenderer.invoke('sys:get'),
  setSystem: (patch) => ipcRenderer.invoke('sys:set', patch),
  exportData: (name, text) => ipcRenderer.invoke('export', name, text),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  focus: () => ipcRenderer.send('focus'),
  alert: (front) => ipcRenderer.send('alert', !!front),
  setTray: (text) => ipcRenderer.send('tray:state', String(text || '')),
  onLock: (cb) => on('lock', cb),
  onResume: (cb) => on('resume', cb),
  onNavigate: (cb) => on('navigate', cb)
});
