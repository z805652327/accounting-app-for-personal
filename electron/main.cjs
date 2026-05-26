const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = !app.isPackaged
let dbPath = ''
let db = null
let inTransaction = false

async function initDatabase() {
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, '../node_modules/sql.js/dist/', file)
  })
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
  while (stmt.step()) {
    const row = stmt.getAsObject()
    // Convert snake_case keys to camelCase to match front-end TypeScript interfaces
    const mapped = {}
    for (const key of Object.keys(row)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      mapped[camelKey] = row[key]
    }
    results.push(mapped)
  }
  stmt.free()
  return results
})

ipcMain.handle('db-insert', (_, sql, params) => {
  let stmt
  try {
    stmt = db.prepare(sql)
    if (params) stmt.bind(params)
    stmt.step()
    const result = db.exec("SELECT last_insert_rowid() as id")
    const id = result[0]?.values[0]?.[0]
    if (typeof id !== 'number' || id <= 0) {
      throw new Error('数据库插入后无法获取有效ID')
    }
    if (!inTransaction) saveDatabase()
    return id
  } catch (err) {
    throw new Error(`数据库插入失败: ${err.message}`)
  } finally {
    if (stmt) stmt.free()
  }
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

// ---- Chinese menu ----

function setChineseMenu() {
  const template = [
    {
      label: '个人记账',
      submenu: [
        { label: '关于', role: 'about' },
        { type: 'separator' },
        { label: '隐藏', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '文件',
      submenu: [
        { label: '新建窗口', role: 'newWindow' },
        { label: '关闭', role: 'close' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '重置缩放', role: 'resetZoom' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放', role: 'zoom' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '了解更多', role: 'about' }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

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
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  if (isDev) {
    const devPort = process.env.VITE_DEV_PORT || '5173'
    await win.loadURL(`http://localhost:${devPort}`)
    win.webContents.openDevTools()
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  setChineseMenu()
  createWindow()
})
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('will-quit', () => { if (db) { saveDatabase(); db.close() } })
