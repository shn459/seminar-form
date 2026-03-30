const https = require('https');
const crypto = require('crypto');

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: clientEmail,
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar'
    ].join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }));

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(header + '.' + claim);
  const signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = header + '.' + claim + '.' + signature;
  const body = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.access_token) resolve(parsed.access_token);
        else reject(new Error('Token error: ' + data));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function apiRequest(hostname, path, method, token, body) {
  const bodyStr = body ? JSON.stringify(body) : '';
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request({ hostname, path, method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getSettings(token) {
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const data = await apiRequest(
    'sheets.googleapis.com',
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/%E3%82%A2%E3%83%B3%E3%82%B1%E3%83%BC%E3%83%88%E8%A8%AD%E5%AE%9A`,
    'GET', token, null
  );

  const settings = { seminarName: '', seminarDate: '', interests: [] };
  if (data.values) {
    data.values.forEach(row => {
      const key = (row[0] || '').trim();
      const val = (row[1] || '').trim();
      if (key === 'セミナー名') settings.seminarName = val;
      else if (key === '日付') settings.seminarDate = val;
      else if (key.indexOf('選択肢') === 0 && val) settings.interests.push(val);
    });
  }
  return settings;
}

async function getAvailableSlots(token) {
  const CALENDAR_ID = process.env.CALENDAR_ID;
  const now = new Date().toISOString();
  const oneMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const path = `/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?timeMin=${now}&timeMax=${oneMonth}&q=%E7%A9%BA%E3%81%8D&singleEvents=true`;

  const data = await apiRequest('www.googleapis.com', path, 'GET', token, null);
  const slots = [];
  if (data.items) {
    data.items.forEach(event => {
      if (event.summary === '空き') {
        slots.push({
          id: event.id,
          start: event.start.dateTime,
          end: event.end.dateTime
        });
      }
    });
  }
  return slots;
}

async function bookSlot(token, eventId, formData) {
  const CALENDAR_ID = process.env.CALENDAR_ID;
  const path = `/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`;

  const event = await apiRequest('www.googleapis.com', path, 'GET', token, null);
  if (!event || event.summary !== '空き') {
    return 'この日程はすでに予約済みです。別の日程を選択してください';
  }

  await apiRequest('www.googleapis.com', path, 'PATCH', token, {
    summary: '予約済み：' + formData.lastName + formData.firstName
  });

  await saveToSheet(token, formData);
  return '予約が完了しました';
}

async function saveToSheet(token, formData) {
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const path = `/v4/spreadsheets/${SPREADSHEET_ID}/values/%E3%82%B7%E3%83%BC%E3%83%881:append?valueInputOption=RAW`;

  await apiRequest('sheets.googleapis.com', path, 'POST', token, {
    values: [[
      new Date().toISOString(),
      formData.lastName, formData.firstName, formData.gender,
      formData.age, formData.email, formData.score, formData.scoreReason,
      formData.interests, formData.consultation,
      formData.slotStart || '', formData.office || '',
      formData.phone || '', formData.comment
    ]]
  });
}

exports.handler = async (event) => {
  const clientEmail = process.env.GAS_CLIENT_EMAIL;
  const privateKey = (process.env.GAS_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  let params = {};
  try { params = JSON.parse(event.body || '{}'); } catch(e) {}

  try {
    const token = await getAccessToken(clientEmail, privateKey);
    let result;

    if (params.action === 'getSettings') {
      result = await getSettings(token);
    } else if (params.action === 'getSlots') {
      result = await getAvailableSlots(token);
    } else if (params.action === 'bookSlot') {
      result = await bookSlot(token, params.eventId, params.formData);
    } else if (params.action === 'saveToSheet') {
      await saveToSheet(token, params.formData);
      result = 'ok';
    } else {
      result = 'ready';
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch(e) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
