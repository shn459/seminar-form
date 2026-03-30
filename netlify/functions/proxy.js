const https = require('https');

function getWithRedirect(url, redirectCount) {
  redirectCount = redirectCount || 0;
  if (redirectCount > 10) return Promise.reject(new Error('Too many redirects'));

  return new Promise(function(resolve, reject) {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(getWithRedirect(res.headers.location, redirectCount + 1));
      } else {
        var data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() { resolve(data); });
      }
    }).on('error', reject);
  });
}

exports.handler = function(event, context, callback) {
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbxMip0eOAxtY-RHMilvcDzkAcVrU8iNnRMG4u7HKSh2vWyv2U9MHN8Vxn74gFJX8M7o/exec';
  
  var params = event.queryStringParameters || {};
  var query = Object.keys(params).map(function(k) {
    return k + '=' + encodeURIComponent(params[k]);
  }).join('&');

  var url = GAS_URL + (query ? '?' + query : '');

  getWithRedirect(url).then(function(data) {
    callback(null, {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: data
    });
  }).catch(function(e) {
    callback(null, {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message })
    });
  });
};
