// Check if electron is registered as a built-in module
import { isBuiltin } from 'module'
console.log('isBuiltin electron:', isBuiltin('electron'))
console.log('isBuiltin fs:', isBuiltin('fs'))

// Check internal binding
try {
  const binding = process._linkedBinding('electron_browser_app')
  console.log('electron_browser_app binding:', typeof binding)
} catch(e) {}

// Check process.moduleLoadList
if (process.moduleLoadList) {
  const native = process.moduleLoadList.filter(m => m.includes('electron') || m.includes('ELECTRON'))
  console.log('electron native modules:', native)
}

// Check what require.resolve finds
import { createRequire } from 'module'
const req = createRequire(import.meta.url)
try {
  const resolved = req.resolve('electron')
  console.log('require.resolve(electron):', resolved)
} catch(e) {
  console.log('resolve error:', e.message)
}

process.exit(0)
