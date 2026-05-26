// Try to use available Chrome-based automation
const { execSync } = require('child_process');

// Check if Chrome is installed
try {
  const result = execSync('where chrome 2>nul || where google-chrome 2>nul || where "Google Chrome" 2>nul || echo NOT_FOUND', { encoding: 'utf8' });
  console.log('Chrome found:', result.trim());
} catch(e) {
  console.log('Chrome not found via where');
}

// Check running processes
try {
  const result = execSync('tasklist /FI "IMAGENAME eq chrome.exe" 2>nul || echo NO_PROCESS', { encoding: 'utf8' });
  console.log('Chrome processes:', result.trim());
} catch(e) {
  console.log('Cannot list processes');
}

console.log('Chrome check done');
