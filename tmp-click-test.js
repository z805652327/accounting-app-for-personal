const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.setViewport({ width: 390, height: 844 });

  // Track console
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('[CONSOLE] ' + msg.text()); });

  // Navigate to main page
  console.log('Navigating to homepage...');
  await page.goto('http://localhost:5178/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  console.log('Initial errors:', errors);

  // Try clicking "记支出" button
  console.log('\nLooking for "记支出" button...');
  const btns = await page.evaluate(() => {
    const allText = document.body?.innerText || '';
    const allEls = Array.from(document.querySelectorAll('*'));
    const btnEls = allEls.filter(el => el.textContent?.includes('记支出'));
    return {
      totalElements: allEls.length,
      buttonTextEntries: btnEls.map(el => ({
        tag: el.tagName,
        class: el.className,
        text: el.textContent?.substring(0, 50),
        rect: el.getBoundingClientRect()
      }))
    };
  });
  console.log('Button info:', JSON.stringify(btns, null, 2));

  // Try clicking the button that contains "记支出"
  const clickResult = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const target = els.find(el => el.textContent?.includes('记支出') && el.tagName === 'UNI-VIEW');
    if (target) {
      (target).click();
      return 'clicked';
    }
    const target2 = els.find(el => el.textContent?.trim() === '记支出');
    if (target2) {
      (target2).click();
      return 'clicked via text match';
    }
    return 'not found';
  });
  console.log('Click result:', clickResult);

  await new Promise(r => setTimeout(r, 3000));

  // Check current page
  const afterClick = await page.evaluate(() => {
    const pageEl = document.querySelector('uni-page');
    return {
      currentPage: pageEl?.getAttribute('data-page') || 'none',
      url: window.location.href
    };
  });
  console.log('\nAfter click:', JSON.stringify(afterClick, null, 2));

  // Try programmatic navigation
  console.log('\nTrying location hash navigation...');
  await page.evaluate(() => {
    window.location.hash = '#/pages/transactions/add?type=expense';
  });
  await new Promise(r => setTimeout(r, 3000));

  const afterHash = await page.evaluate(() => {
    const pageEl = document.querySelector('uni-page');
    return {
      currentPage: pageEl?.getAttribute('data-page') || 'none',
      url: window.location.href,
      hash: window.location.hash
    };
  });
  console.log('After hash nav:', JSON.stringify(afterHash, null, 2));

  // Check errors
  console.log('\nAll errors:', [...new Set(errors)]);

  await browser.close();
}
main().catch(e => console.error(e));
