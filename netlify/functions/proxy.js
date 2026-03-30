const https = require('https');

function fetchWithRedirect(url, redirectCount) {
  redirectCount = redirectCount || 0;
  if (redirectCount > 5) {
    return Promise.reject(new Error('Too many redirects'));
  }

  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchWithRedirect(res.headers.location, redirectCount + 1));
      } else {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
      }
    }).on('error', reject);
  });
}

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const query = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const gasUrl = 'https://script.google.com/macros/s/AKfycbwOSbW0ThYTMNlxI-Y13v3lIFjtGEs9wvHxlxQUO9IRWdw-cwz3sDnALiuMqIqaxo5n/exec?' + query;

  try {
    const data = await fetchWithRedirect(gasUrl);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: data
    };
  } catch(e) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
