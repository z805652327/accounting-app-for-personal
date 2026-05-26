// Find how to access the real Electron API
const { app } = await import('electron')

// List all module load entries
console.log('=== moduleLoadList (electron related) ===')
process.moduleLoadList?.filter(m => m.includes('electron') || m.includes('ELECTRON')).forEach(m => console.log(' ', m))

// Check what's in electron's resources
import { createRequire } from 'module'
const req = createRequire(process.execPath + '/noop')

// Check if there's an asar or native binding
try {
  const native = process._linkedBinding('electron_browser_app')
  console.log('\n_linkedBinding(electron_browser_app):', typeof native)
} catch(e) {
  console.log('\n_linkedBinding error:', e.message)
}

console.log('\nprocess.type:', process.type)
console.log('process.resourcesPath:', process.resourcesPath)

app.quit()
