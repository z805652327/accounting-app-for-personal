import { app } from 'electron'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

console.log('=== ESM Import Test ===')
console.log('app:', typeof app)

// Try dynamic import for the full module
const mod = await import('electron')
console.log('dynamic import keys:', Object.keys(mod).slice(0, 20))

// Check default export
const defaultExport = mod.default
console.log('default type:', typeof defaultExport)
if (defaultExport && typeof defaultExport === 'object') {
  console.log('default keys:', Object.keys(defaultExport).slice(0, 30))
}

// Try CJS require via createRequire from electron.exe directory
const req = createRequire(process.execPath + '/noop.js')
try {
  const e = req('electron')
  console.log('\nCJS from execPath dir:', typeof e)
  if (typeof e === 'object' && e) {
    console.log('keys:', Object.keys(e).slice(0, 20))
    console.log('has BrowserWindow:', 'BrowserWindow' in e)
    console.log('has ipcMain:', 'ipcMain' in e)
  } else {
    console.log('value (truncated):', String(e).slice(0, 100))
  }
} catch(e) {
  console.log('\nCJS error:', e.message.slice(0, 100))
}

// Also try mod['module.exports']
const cjsExport = mod['module.exports']
if (cjsExport) {
  console.log('\nmodule.exports type:', typeof cjsExport)
  console.log('module.exports value (truncated):', String(cjsExport).slice(0, 100))
  if (typeof cjsExport === 'object') {
    console.log('module.exports keys:', Object.keys(cjsExport).slice(0, 20))
  }
}

app.quit()
