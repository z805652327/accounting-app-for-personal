// ESM: test named exports from electron
import { app } from 'electron'
console.log('named import app:', typeof app)
// The rest via default import
import mod from 'electron'
console.log('default import type:', typeof mod)
if (mod && typeof mod === 'object') {
  console.log('keys:', Object.keys(mod).slice(0, 10))
  console.log('has BrowserWindow:', 'BrowserWindow' in mod)
  console.log('has ipcMain:', 'ipcMain' in mod)
  console.log('has dialog:', 'dialog' in mod)
} else {
  // Maybe named exports work differently
  console.log('default import value:', mod)
}
app.quit()
