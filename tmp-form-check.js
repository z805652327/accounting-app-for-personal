const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.setViewport({ width: 390, height: 844 });

  const errors = [];
  page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('[CONSOLE] ' + msg.text()); });

  // Navigate to homepage first, then use hash to nav to add page
  await page.goto('http://localhost:5178/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Navigate via hash
  console.log('Navigating to add page via hash...');
  await page.evaluate(() => {
    window.location.hash = '#/pages/transactions/add?type=expense';
  });
  await new Promise(r => setTimeout(r, 5000));

  // Take screenshot
  await page.screenshot({
    path: 'D:\\accounting app\\tmp-form-page.jpg',
    type: 'jpeg',
    quality: 80,
    fullPage: true
  });
  console.log('Form page screenshot saved');

  // Check DOM structure
  const domInfo = await page.evaluate(() => {
    const pageEl = document.querySelector('uni-page');
    const currentPage = pageEl?.getAttribute('data-page') || 'none';

    // Get all elements
    const allEls = Array.from(document.querySelectorAll('*'));
    const allTags = allEls.map(e => e.tagName);
    const uniqueTags = [...new Set(allTags)].sort();

    // Check for uview components
    const uviewTags = uniqueTags.filter(t => /^U-/i.test(t));
    const uniPageBody = document.querySelector('uni-page-body');
    const bodyContent = uniPageBody?.innerHTML?.substring(0, 2000) || 'no body content';

    // Check for form elements
    const hasFormTags = allTags.some(t => t === 'U-FORM' || t === 'U-FORM-ITEM' || t === 'U-INPUT');

    // Check for visible text
    const bodyText = document.body?.innerText || '';

    return {
      currentPage,
      uniqueTags,
      uviewComponents: uviewTags,
      hasFormTags,
      bodyTextPreview: bodyText.substring(0, 1000),
      totalElements: allEls.length,
      pageBodyStart: bodyContent.substring(0, 1000)
    };
  });

  console.log('DOM Info:', JSON.stringify(domInfo, null, 2));

  // All errors
  const uniqueErrors = [...new Set(errors)];
  console.log('\nAll errors (' + uniqueErrors.length + '):');
  uniqueErrors.forEach(e => console.log('  ' + e));

  await browser.close();
}
main().catch(e => console.error(e));
