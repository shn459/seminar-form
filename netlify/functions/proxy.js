const https = require('https');

exports.handler = async function(event) {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbzl9Gq_uLvQ02l56QxyHCm0R3-8X3NVOA3qfEGsEwQ72c8qnUniIIChgN-cMc8l6Wda/exec';

  const body = event.body || '{}';

  return new Promise((resolve) => {
    const req = https.request(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type'
          },
          body: data
        });
      });
    });

    req.on('error', (e) => {
      resolve({
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: e.message })
      });
    });

    req.write(body);
    req.end();
  });
};
