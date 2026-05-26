const http = require('http');
const fs = require('fs');

function fetchUrl(path, outputFile) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5178,
      path: path,
      method: 'GET',
      headers: { 'Accept': '*/*' }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        fs.writeFileSync(outputFile, data);
        console.log(`Fetched ${path} -> ${outputFile} (${data.length} bytes, status ${res.statusCode})`);
        resolve();
      });
    });
    req.on('error', e => reject(e));
    req.end();
  });
}

async function main() {
  await fetchUrl('/src/main.ts', 'D:\\accounting app\\tmp-main.ts');
  await fetchUrl('/src/pages/transactions/add.vue', 'D:\\accounting app\\tmp-add.vue');
  console.log('Done');
}
main().catch(e => console.error('Error:', e.message));
