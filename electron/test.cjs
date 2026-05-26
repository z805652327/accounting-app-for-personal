const { app } = require('electron')
const fs = require('fs')
const path = require('path')

console.log('app:', typeof app)
console.log('app.isPackaged:', app?.isPackaged)

const html = '<html><body><h1>Electron Works!</h1></body></html>'
fs.writeFileSync(path.join(__dirname, 'test.html'), html)

app.whenReady().then(() => {
  const { BrowserWindow } = require('electron')
  const win = new BrowserWindow({ width: 400, height: 300 })
  win.loadFile(path.join(__dirname, 'test.html'))
  console.log('Window created')
})
