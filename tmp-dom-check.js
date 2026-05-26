const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.setViewport({ width: 390, height: 844 }); // iPhone 14 size

  // Navigate to add page
  await page.goto('http://localhost:5178/pages/transactions/add?type=expense', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });
  await new Promise(r => setTimeout(r, 3000));

  // Screenshot as jpeg
  await page.screenshot({
    path: 'D:\\accounting app\\tmp-add-page.jpg',
    type: 'jpeg',
    quality: 80,
    fullPage: true
  });
  console.log('Screenshot saved as JPEG');

  // Also get page DOM structure
  const domInfo = await page.evaluate(() => {
    const app = document.getElementById('app');
    if (!app) return { error: 'no app element' };

    const children = app.children;
    const tagNames = Array.from(children).map(c => c.tagName);

    // Check for uview-plus components
    const allElements = document.querySelectorAll('*');
    const allTags = Array.from(allElements).map(e => e.tagName);
    const uviewTags = allTags.filter(t => t.toLowerCase().startsWith('u-') || t.toLowerCase().startsWith('uni-'));
    const uniqueTags = [...new Set(uviewTags)].sort();

    // Check current page
    const pageEl = document.querySelector('uni-page');
    const pageAttr = pageEl?.getAttribute('data-page') || 'none';

    return {
      appChildren: tagNames,
      uniqueTags: uniqueTags,
      currentPage: pageAttr,
      totalElements: allElements.length,
      pageHTML: document.body?.innerHTML?.substring(0, 3000) || 'none'
    };
  });

  console.log('DOM Info:', JSON.stringify(domInfo, null, 2));

  await browser.close();
}
main().catch(e => console.error(e));
