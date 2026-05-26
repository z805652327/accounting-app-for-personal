// Launcher for Electron that strips the problematic ELECTRON_RUN_AS_NODE env var
const { spawn } = require('child_process');
const path = require('path');

const electronExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const mainEntry = path.join(__dirname, '..', 'build', 'electron-main.cjs');

// Build a clean environment — explicitly unset the problematic var
const env = {};
for (const key of Object.keys(process.env)) {
  if (key !== 'ELECTRON_RUN_AS_NODE') {
    env[key] = process.env[key];
  }
}

const child = spawn(electronExe, ['--remote-debugging-port=9224', mainEntry], {
  stdio: 'inherit',
  env,
  windowsHide: false,
});

child.on('close', (code, signal) => {
  if (code === null) {
    console.error('electron exited with signal', signal);
    process.exit(1);
  }
  process.exit(code);
});

process.on('SIGINT', () => { if (!child.killed) child.kill('SIGINT'); });
process.on('SIGTERM', () => { if (!child.killed) child.kill('SIGTERM'); });
