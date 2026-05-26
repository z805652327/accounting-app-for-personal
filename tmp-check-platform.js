const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  await page.goto('http://localhost:5178/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  const platformInfo = await page.evaluate(() => {
    return {
      hasPlus: typeof plus !== 'undefined',
      hasPlusSqlite: typeof plus !== 'undefined' && plus.sqlite !== undefined,
      hasUniConfig: typeof __uniConfig !== 'undefined',
      uniConfigType: typeof __uniConfig,
      uniConfigValue: typeof __uniConfig !== 'undefined' ? JSON.stringify(__uniConfig).substring(0, 200) : 'N/A',
      hasWindow: typeof window !== 'undefined',
      hasElectronDB: typeof window !== 'undefined' && window.electronDB !== undefined,
    };
  });

  console.log('Platform detection info:', JSON.stringify(platformInfo, null, 2));

  await browser.close();
}
main().catch(e => console.error(e));
