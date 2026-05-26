const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Collect all console messages
  const consoleLogs = [];
  const consoleErrors = [];
  const consoleWarnings = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(text);
    } else {
      consoleLogs.push(text);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push('PAGE ERROR: ' + err.message);
  });

  page.on('requestfailed', request => {
    consoleErrors.push('REQUEST FAILED: ' + request.url() + ' - ' + (request.failure()?.errorText || 'unknown'));
  });

  // Step 1: Navigate to http://localhost:5178/
  console.log('\n=== Step 1: Navigating to http://localhost:5178/ ===');
  try {
    await page.goto('http://localhost:5178/', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('Page loaded successfully');
  } catch (e) {
    console.error('Navigation failed:', e.message);
    await browser.close();
    return;
  }

  // Wait for the app to initialize
  await sleep(3000);

  console.log('\n=== Step 2: Console Logs on Homepage ===');
  consoleLogs.forEach(log => console.log('  [LOG]:', log));
  console.log('\n=== Console Warnings on Homepage ===');
  consoleWarnings.forEach(w => console.log('  [WARN]:', w));
  console.log('\n=== Console Errors on Homepage ===');
  consoleErrors.forEach(e => console.log('  [ERROR]:', e));

  // Take a screenshot of the homepage
  console.log('\n=== Step 3: Taking homepage screenshot ===');
  await page.screenshot({ path: 'D:\\accounting app\\tmp-homepage.png', fullPage: true });
  console.log('Homepage screenshot saved to tmp-homepage.png');

  // Check page content
  const pageContent = await page.evaluate(() => {
    return {
      title: document.title,
      bodyHTML: document.body?.innerHTML?.substring(0, 1000) || 'no body',
      appDiv: document.getElementById('app')?.innerHTML?.substring(0, 500) || 'no app div content'
    };
  });
  console.log('\nPage content:', JSON.stringify(pageContent, null, 2));

  // Step 4: Navigate to add transaction page
  console.log('\n=== Step 4: Navigating to add transaction page (expense) ===');
  consoleErrors.length = 0;
  consoleWarnings.length = 0;
  consoleLogs.length = 0;

  try {
    await page.goto('http://localhost:5178/pages/transactions/add?type=expense', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    console.log('Add transaction page loaded');
  } catch (e) {
    console.error('Navigation to add page failed:', e.message);
  }

  await sleep(3000);

  console.log('\n=== Step 5: Console Logs on Add Transaction Page ===');
  consoleLogs.forEach(log => console.log('  [LOG]:', log));
  console.log('\n=== Console Warnings on Add Transaction Page ===');
  consoleWarnings.forEach(w => console.log('  [WARN]:', w));
  console.log('\n=== Console Errors on Add Transaction Page ===');
  consoleErrors.forEach(e => console.log('  [ERROR]:', e));

  // Take a screenshot of the add transaction page
  console.log('\n=== Step 6: Taking add page screenshot ===');
  await page.screenshot({ path: 'D:\\accounting app\\tmp-add-page.png', fullPage: true });
  console.log('Add page screenshot saved to tmp-add-page.png');

  // Step 5: Check the page content for form components
  console.log('\n=== Step 7: Checking form component rendering ===');
  const addPageContent = await page.evaluate(() => {
    const appContent = document.getElementById('app')?.innerHTML || '';

    // Check for u-form related elements
    const hasUForm = appContent.includes('u-form') || document.querySelector('.u-form') !== null;

    // Check for input elements
    const inputs = document.querySelectorAll('input');
    const inputLabels = Array.from(inputs).map(i => ({
      placeholder: i.placeholder,
      type: i.type,
      id: i.id
    }));

    // Check for any visible text that indicates form rendering
    const bodyText = document.body?.innerText || '';

    return {
      hasAppContent: appContent.length > 0,
      appContentPreview: appContent.substring(0, 2000),
      inputCount: inputs.length,
      inputDetails: inputLabels,
      bodyText: bodyText.substring(0, 2000),
      uFormExists: hasUForm,
    };
  });
  console.log('Add page content:', JSON.stringify(addPageContent, null, 2));

  // Step 6: Check if uniapp is rendering
  const uniAppCheck = await page.evaluate(() => {
    // Check for uni-app specific elements
    const uniViews = document.querySelectorAll('uni-view, [class*="page-"], .page-add');
    const uniPages = document.querySelectorAll('.uni-page-body, uni-page');

    return {
      uniViewCount: uniViews.length,
      uniPageCount: uniPages.length,
      pageAddElements: document.querySelectorAll('.page-add').length,
      allElements: document.body?.querySelectorAll('*').length || 0
    };
  });
  console.log('\nUni-app rendering check:', JSON.stringify(uniAppCheck, null, 2));

  // Close
  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(e => {
  console.error('Script failed:', e);
  process.exit(1);
});
