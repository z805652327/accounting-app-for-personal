// Try to find Chrome DevTools Protocol debugging endpoints
const http = require('http');
const { execSync } = require('child_process');

// Method 1: Check common CDP ports
const ports = [9222, 9223, 9229, 9230, 9231, 9232, 9422];

async function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          console.log(`CDP found on port ${port}:`, JSON.stringify({
            Browser: info.Browser,
            'User Agent': info['User-Agent'],
            'Web Socket Debugger URL': info.webSocketDebuggerUrl?.substring(0, 80)
          }, null, 2));
          resolve(true);
        } catch(e) {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

// Method 2: Check Chrome command line via WMI
try {
  const wmi = execSync(
    'powershell -Command "Get-CimInstance Win32_Process -Filter \\\"Name = \'chrome.exe\'\\\" | Select-Object -First 1 -ExpandProperty CommandLine"',
    { encoding: 'utf8', timeout: 5000 }
  );
  if (wmi.includes('remote-debugging-port')) {
    const match = wmi.match(/--remote-debugging-port=(\d+)/);
    if (match) {
      console.log(`Chrome started with CDP on port: ${match[1]}`);
    }
  }
} catch(e) {
  console.log('WMI check failed or no CDP flag');
}

async function main() {
  console.log('Scanning for CDP ports...');
  for (const port of ports) {
    const found = await checkPort(port);
    if (found) break;
  }
  console.log('Scan complete');
}
main();
