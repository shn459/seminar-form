const https = require('https');

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const query = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const gasUrl = 'https://script.google.com/macros/s/AKfycbwOSbW0ThYTMNlxI-Y13v3lIFjtGEs9wvHxlxQUO9IRWdw-cwz3sDnALiuMqIqaxo5n/exec?' + query;

  return new Promise((resolve) => {
    https.get(gasUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: data
        });
      });
    }).on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });
  });
};
