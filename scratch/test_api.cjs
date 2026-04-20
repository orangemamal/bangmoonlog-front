
const https = require('https');

const data = JSON.stringify({
  accessToken: 'test_token'
});

const options = {
  hostname: 'bangmoonlog.vercel.app',
  port: 443,
  path: '/api/naverAuth',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let body = '';
  res.on('data', (d) => {
    body += d;
  });
  res.on('end', () => {
    console.log(`Response Body: ${body}`);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
