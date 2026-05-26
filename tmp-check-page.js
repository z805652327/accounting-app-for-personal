// Simple HTTP request to check the page
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5178,
  path: '/src/main.ts',
  method: 'GET',
  headers: { 'Accept': 'text/javascript' }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', JSON.stringify(res.headers, null, 2));
    console.log('Body (first 2000 chars):');
    console.log(data.substring(0, 2000));
  });
});
req.on('error', e => console.error('Error:', e.message));
req.end();
