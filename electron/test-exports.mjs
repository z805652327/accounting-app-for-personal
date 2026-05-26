// Get the electron module and extract its CJS compatibility export
import mod from 'electron'
console.log('default type:', typeof mod)
console.log('default keys:', mod ? Object.keys(mod).slice(0, 30) : 'N/A')

// Check module.exports which is the CJS compatibility export
import { createRequire } from 'module'
const req = createRequire(import.meta.url)

// Find the real electron module by resolving to the npm package's parent
const electronPkgPath = req.resolve('electron')
console.log('electron resolve path:', electronPkgPath)

// Try to directly access electron's internal bindings
// These are available in Electron's main process
console.log('process.type:', process.type)  // 'browser' in main process
console.log('process.electronBinding:', typeof process.electronBinding)
console.log('process.moduleLoadList (filtered):', process.moduleLoadList?.filter(m => m.includes('electron')))
process.exit(0)
