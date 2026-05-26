// This file is loaded by Electron via package.json main
// Check what require('electron') actually resolves to
const e = require('electron')
console.log('typeof e:', typeof e)
console.log('e === null:', e === null)
console.log('e === undefined:', e === undefined)
console.log('is string:', typeof e === 'string')

// Check resolve path
const Module = require('module')
const origResolve = Module._resolveFilename
const resolvedPath = origResolve('electron', module)
console.log('resolved path:', resolvedPath)

// Check process info
console.log('node version:', process.version)
console.log('electron version:', process.versions?.electron)
console.log('process.type:', process.type)

// If e is a string, it's the npm package path
if (typeof e === 'string') {
  console.log('value (first 100 chars):', e.substring(0, 100))
}

process.exit(0)
