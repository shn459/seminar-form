const https = require('https');
const crypto = require('crypto');

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function getAccessToken(clientEmail, privateKey) {
  var now = Math.floor(Date.now() / 1000);
  var header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claim = base64url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }));

  var sign = crypto.createSign('RSA-SHA256');
  sign.update(header + '.' + claim);
  var signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  var jwt = header + '.' + claim + '.' + signature;

  return new Promise(function(resolve, reject) {
    var body = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;
    var req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        var parsed = JSON.parse(data);
        if (parsed.access_token) resolve(parsed.access_token);
        else reject(new Error('Token error: ' + data));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callGAS(scriptId, functionName, parameters, accessToken) {
  var body = JSON.stringify({
    function: functionName,
    parameters: parameters
  });

  return new Promise(function(resolve, reject) {
    var req = https.request({
      hostname: 'script.googleapis.com',
      path: '/v1/scripts/' + scriptId + ':run',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken,
        'Content-Length': Buffer.byteLength(body)
      }
    }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve(data); });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = function(event, context, callback) {
  var SCRIPT_ID = '1hvwBkEWQiHePk-1tcG0be4SCSn_RHfRIRzUOf1_rFGyfww6NwKLsL3RQ';
  var clientEmail = process.env.GAS_CLIENT_EMAIL;
  var privateKey = (process.env.GAS_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  var params = {};
  try { params = JSON.parse(event.body || '{}'); } catch(e) {}

  var action = params.action;
  var functionName;
  var parameters = [];

  if (action === 'getSettings') {
    functionName = 'getSettings';
  } else if (action === 'getSlots') {
    functionName = 'getAvailableSlots';
  } else if (action === 'bookSlot') {
    functionName = 'bookSlot';
    parameters = [params.eventId, params.formData];
  } else if (action === 'saveToSheet') {
    functionName = 'saveToSheet';
    parameters = [params.formData];
  } else {
    callback(null, { statusCode: 200, body: '"ready"' });
    return;
  }

  getAccessToken(clientEmail, privateKey).then(function(token) {
    return callGAS(SCRIPT_ID, functionName, parameters, token);
  }).then(function(data) {
    var parsed = JSON.parse(data);
    var result = parsed.response && parsed.response.result !== undefined
      ? parsed.response.result
      : parsed;
    callback(null, {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    });
  }).catch(function(e) {
    callback(null, {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message })
    });
  });
};
