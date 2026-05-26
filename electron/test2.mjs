// Test: dynamic import of electron in ESM
const mod = await import('electron')
console.log('mod type:', typeof mod)
console.log('mod keys:', Object.keys(mod).slice(0, 20))
console.log('mod.app:', typeof mod.app)
console.log('mod.BrowserWindow:', typeof mod.BrowserWindow)
console.log('mod.ipcMain:', typeof mod.ipcMain)
console.log('mod.dialog:', typeof mod.dialog)
// Also try the default export
console.log('mod.default:', typeof mod.default)
if (mod.default && typeof mod.default === 'object') {
  console.log('default keys:', Object.keys(mod.default).slice(0, 30))
}
process.exit(0)
