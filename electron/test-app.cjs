const electron = require('electron')
console.log('electron type:', typeof electron)
console.log('electron value (truncated):', String(electron).slice(0, 100))

// Check all process properties related to Electron
const keys = Object.getOwnPropertyNames(process)
const electronKeys = keys.filter(k =>
  k.toLowerCase().includes('electron') ||
  k.toLowerCase().includes('type') ||
  k === 'resourcesPath' ||
  k === 'sandboxed'
)
console.log('relevant process keys:', electronKeys)

// Check process features
if (process.features) {
  console.log('process.features:', JSON.stringify(process.features))
}

// Check if _linkedBinding works
const bindingNames = ['electron_browser_app', 'electron_browser_window', 'electron_common_ipc']
for (const name of bindingNames) {
  try {
    const binding = process._linkedBinding(name)
    console.log(`_linkedBinding(${name}):`, typeof binding)
  } catch(e) {
    console.log(`_linkedBinding(${name}): error`)
  }
}

// Check module._resolveFilename patching
const Module = require('module')
const resolveSrc = Module._resolveFilename.toString().slice(0, 200)
console.log('\n_resolveFilename patch:', resolveSrc.includes('electron') ? 'HAS_ELECTRON_PATCH' : 'NO_PATCH')

setTimeout(() => process.exit(0), 500)
