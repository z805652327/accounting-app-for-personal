// Test all possible electron subpath imports
const subpaths = [
  'electron/main',
  'electron/common',
  'electron/renderer',
  'electron/browser-window',
  'electron/ipc-main',
  'electron/dialog',
]

for (const sub of subpaths) {
  try {
    const mod = await import(sub)
    console.log(sub + ':', Object.keys(mod).slice(0, 15).join(', '))
  } catch(e) {
    console.log(sub + ': FAIL -', e.message.slice(0, 80))
  }
}

// Also try the all-namespace import
try {
  const ns = await import('electron')
  console.log('\nelectron namespace:', Object.getOwnPropertyNames(ns).slice(0, 20).join(', '))
} catch(e) {
  console.log('\nelectron namespace FAIL:', e.message.slice(0, 80))
}

process.exit(0)
