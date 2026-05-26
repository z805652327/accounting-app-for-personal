import { createRequire } from 'module'

// Create a require context from Electron's own directory (not our project)
const electronDir = process.execPath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
const req = createRequire(electronDir + '/noop.js')

try {
  // This should bypass our node_modules since it resolves from electron.exe's directory
  const electron = req('electron')
  console.log('electron type:', typeof electron)
  if (electron && typeof electron === 'object') {
    console.log('has app:', 'app' in electron)
    console.log('has BrowserWindow:', 'BrowserWindow' in electron)
    console.log('has ipcMain:', 'ipcMain' in electron)
  }
} catch(e) {
  console.log('electron error:', e.message)
}

// Try alternative: use process._linkedBinding or similar internals
console.log('\nprocess.type:', process.type)
console.log('process.versions.electron:', process.versions.electron)

// Try native module
try {
  const electron2 = process._linkedBinding('electron_browser_app')
  console.log('\n_linkedBinding result:', typeof electron2)
} catch(e) {
  console.log('\n_linkedBinding error:', e.message)
}

process.exit(0)
