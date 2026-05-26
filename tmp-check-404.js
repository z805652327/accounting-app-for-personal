const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const failedRequests = [];
  page.on('requestfailed', request => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText || 'unknown'
    });
  });

  // Track all requests and their responses
  const requestStatuses = [];
  page.on('request', request => {
    if (request.url().includes('localhost')) {
      requestStatuses.push({ url: request.url(), status: 'pending' });
    }
  });
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    const existing = requestStatuses.find(r => r.url === url);
    if (existing) {
      existing.status = status;
    } else if (url.includes('localhost')) {
      requestStatuses.push({ url, status });
    }
  });

  await page.goto('http://localhost:5178/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  console.log('=== Failed Requests ===');
  failedRequests.forEach(r => console.log(JSON.stringify(r, null, 2)));

  console.log('\n=== Request Statuses (non-200) ===');
  requestStatuses
    .filter(r => r.status !== 200 && r.status !== 'pending')
    .forEach(r => console.log(JSON.stringify(r, null, 2)));

  await browser.close();
}
main().catch(e => console.error(e));
