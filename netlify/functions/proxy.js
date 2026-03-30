const https = require('https');

function postWithRedirect(url, body, redirectCount) {
  redirectCount = redirectCount || 0;
  if (redirectCount > 5) return Promise.reject(new Error('Too many redirects'));

  return new Promise((resolve, reject) => {
    console.log('Requesting URL:', url, 'redirect count:', redirectCount);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      console.log('Status:', res.statusCode, 'Location:', res.headers.location);
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(postWithRedirect(res.headers.location, body, redirectCount + 1));
      } else {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          console.log('Response data (​​​​​​​​​​​​​​​​
