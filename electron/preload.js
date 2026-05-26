const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronDB', {
  execute: (sql, params) => ipcRenderer.invoke('db-execute', sql, params),
  query: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
  queryOne: async (sql, params) => {
    const rows = await ipcRenderer.invoke('db-query', sql, params)
    return rows.length > 0 ? rows[0] : null
  },
  insert: (sql, params) => ipcRenderer.invoke('db-insert', sql, params),
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  selectDbPath: () => ipcRenderer.invoke('select-db-path'),
})
