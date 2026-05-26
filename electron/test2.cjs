// Test dynamic import in CJS (uses ESM loader)
import('electron').then(mod => {
  console.log('dynamic import keys:', Object.keys(mod).slice(0, 20))
  console.log('has app:', typeof mod.app)
  console.log('has BrowserWindow:', typeof mod.BrowserWindow)
  console.log('has ipcMain:', typeof mod.ipcMain)
  console.log('has dialog:', typeof mod.dialog)
  process.exit(0)
}).catch(e => {
  console.error('error:', e.message)
  process.exit(1)
})
