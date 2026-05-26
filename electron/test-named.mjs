// Test: which named exports work from 'electron' in ESM?
const names = ['app', 'BrowserWindow', 'ipcMain', 'dialog', 'Menu', 'shell', 'Notification', 'Tray', 'nativeTheme', 'safeStorage', 'net', 'session', 'powerMonitor', 'clipboard', 'nativeImage', 'screen', 'desktopCapturer', 'globalShortcut', 'systemPreferences']

for (const name of names) {
  try {
    const mod = await import('electron')
    if (name in mod) {
      console.log(`  ✅ ${name}`)
    } else {
      console.log(`  ❌ ${name} (not in namespace)`)
    }
  } catch(e) {
    console.log(`  ❌ ${name} (import error: ${e.message.slice(0,50)})`)
  }
}

process.exit(0)
