import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const isDev = !app.isPackaged
let dbPath = ''
let db = null
let inTransaction = false

async function initDatabase() {
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs()
  let saved = null
  if (fs.existsSync(dbPath)) {
    saved = fs.readFileSync(dbPath)
  }
  db = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database()
  db.run('PRAGMA journal_mode=WAL')
  db.run('PRAGMA foreign_keys=ON')
}

function saveDatabase() {
  if (!db) return
  const data = db.export()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(dbPath, Buffer.from(data))
}

// ---- IPC handlers ----

ipcMain.handle('db-execute', (_, sql, params) => {
  const s = sql.trim().toUpperCase()
  if (s === 'BEGIN') inTransaction = true
  else if (s === 'COMMIT' || s === 'ROLLBACK') inTransaction = false
  db.run(sql, params)
  if (!inTransaction) saveDatabase()
})

ipcMain.handle('db-query', (_, sql, params) => {
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  return results
})

ipcMain.handle('db-insert', (_, sql, params) => {
  db.run(sql, params)
  if (!inTransaction) saveDatabase()
  const id = db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] ?? 0
  return id
})

ipcMain.handle('get-db-path', () => dbPath)

ipcMain.handle('select-db-path', async () => {
  const result = await dialog.showSaveDialog({
    defaultPath: dbPath,
    filters: [{ name: '账本数据库', extensions: ['db'] }]
  })
  if (result.canceled || !result.filePath) return dbPath
  dbPath = result.filePath
  const cfgPath = path.join(app.getPath('userData'), 'electron-config.json')
  fs.writeFileSync(cfgPath, JSON.stringify({ dbPath }))
  await initDatabase()
  return dbPath
})

// ---- Window ----

async function createWindow() {
  const cfgPath = path.join(app.getPath('userData'), 'electron-config.json')
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
    dbPath = cfg.dbPath
  } catch {}
  if (!dbPath) {
    dbPath = path.join(app.getPath('documents'), '个人账本', 'accounting.db')
  }

  await initDatabase()

  const win = new BrowserWindow({
    width: 420,
    height: 780,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  if (isDev) {
    await win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('will-quit', () => { if (db) { saveDatabase(); db.close() } })
