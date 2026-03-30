const https = require('https');

function postToGAS(url, body) {
  return new Promise(function(resolve, reject) {
    var data = Buffer.from(body);
    var options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'Mozilla/5.0'
      }
    };

    var req = https.request(url, options, function(res) {
      var result = '';
      res.on('data', function(chunk) { result += chunk; });
      res.on('end', function() { resolve(result); });
    });

    req.on('error', function(e) { reject(e); });
    req.write(data);
    req.end();
  });
}

exports.handler = function(event, context, callback) {
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbzl9Gq_uLvQ02l56QxyHCm0R3-8X3NVOA3qfEGsEwQ72c8qnUniIIChgN-cMc8l6Wda/exec';
  var body = event.body || '{}';

  postToGAS(GAS_URL, body).then(function(data) {
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
