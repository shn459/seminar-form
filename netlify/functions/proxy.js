const https = require('https');
const http = require('http');

function fetchWithRedirect(url, redirectCount) {
  redirectCount = redirectCount || 0;
  if (redirectCount > 10) {
    return Promise.reject(new Error('Too many redirects'));
  }

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/javascript, */*'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const location = res.headers.location;
        res.resume();
        resolve(fetchWithRedirect(location, redirectCount + 1));
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
  const query = Object.keys(params)
    .filter(k => k !== 'callback')
    .map(k => k + '=' + encodeURIComponent(params[k]))
    .join('&');
  
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
