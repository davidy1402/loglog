/**
 * PutPut APNs Web Push Relay & Scheduler
 * Cloudflare Worker (Pure Web Crypto, 0 Dependencies)
 */

const VAPID = {
  publicKey: 'BESInMhTogu5qLjgz9f8jyMhG2pQRBGYU12USMTFJXrel-L1Ubm-8IQF_MO3lLmREp1_anGdOf1K7Msc-wq4g-g',
  privateKey: 'tpZBQKSfHHiQQoYWIS4SuYA6UHwlqAt3vE9JBDgLDFQ',
  subject: 'mailto:david@davidyong.dev'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function base64UrlToUint8(str) {
  const pad = '='.repeat((4 - str.length % 4) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ToBase64Url(u8) {
  let binary = '';
  for (let i = 0; i < u8.length; i++) {
    binary += String.fromCharCode(u8[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createVapidJwt(audience) {
  const pubBytes = base64UrlToUint8(VAPID.publicKey);
  const x = uint8ToBase64Url(pubBytes.slice(1, 33));
  const y = uint8ToBase64Url(pubBytes.slice(33, 65));

  const privKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: VAPID.privateKey, x, y },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const te = new TextEncoder();
  const header = uint8ToBase64Url(te.encode(JSON.stringify({ alg: 'ES256', typ: 'JWT' })));
  const payload = uint8ToBase64Url(te.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: VAPID.subject
  })));

  const unsigned = te.encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, unsigned);
  const sigB64 = uint8ToBase64Url(new Uint8Array(signature));

  return `${header}.${payload}.${sigB64}`;
}

async function encryptPayload(subscription, payloadText) {
  const te = new TextEncoder();
  const recipientRaw = base64UrlToUint8(subscription.keys.p256dh);
  const authSecret = base64UrlToUint8(subscription.keys.auth);

  const recipientKey = await crypto.subtle.importKey(
    'raw',
    recipientRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const localPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const localRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localPair.publicKey));

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientKey },
    localPair.privateKey,
    256
  );

  const sharedKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);

  const infoPrefix = te.encode('WebPush: info\0');
  const ikmInfo = new Uint8Array(infoPrefix.length + recipientRaw.length + localRaw.length);
  ikmInfo.set(infoPrefix, 0);
  ikmInfo.set(recipientRaw, infoPrefix.length);
  ikmInfo.set(localRaw, infoPrefix.length + recipientRaw.length);

  const ikmBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: ikmInfo },
    sharedKey,
    256
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikmKey = await crypto.subtle.importKey('raw', ikmBits, 'HKDF', false, ['deriveBits', 'deriveKey']);

  const cek = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('Content-Encoding: aes128gcm\0') },
    ikmKey,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt']
  );

  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('Content-Encoding: nonce\0') },
    ikmKey,
    96
  );
  const nonce = new Uint8Array(nonceBits);

  const plaintext = te.encode(payloadText);
  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext, 0);
  padded[plaintext.length] = 2; // Delimiter

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cek,
    padded
  );

  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  const view = new DataView(header.buffer);
  view.setUint32(16, 4096, false); // rs = 4096
  header[20] = 65; // idlen
  header.set(localRaw, 21);

  const body = new Uint8Array(header.length + ciphertext.byteLength);
  body.set(header, 0);
  body.set(new Uint8Array(ciphertext), header.length);

  return body;
}

async function sendWebPush(subscription, payloadObj) {
  const endpointUrl = new URL(subscription.endpoint);
  const audience = endpointUrl.origin;
  const jwt = await createVapidJwt(audience);
  const encryptedBody = await encryptPayload(subscription, JSON.stringify(payloadObj));

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'TTL': '86400',
      'Urgency': 'high',
      'Authorization': `vapid t=${jwt}, k=${VAPID.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream'
    },
    body: encryptedBody
  });

  return {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok
  };
}

function generateReminderMessage(data, now) {
  const lastRecordTs = data.lastRecordTs || (data.nextRemindAt ? data.nextRemindAt - (data.hours || 48) * 3600000 : now - 48 * 3600000);
  const elapsedMs = Math.max(0, now - lastRecordTs);
  const days = Math.floor(elapsedMs / 86400000);
  const hours = Math.floor((elapsedMs % 86400000) / 3600000);

  let timeStr = '';
  if (days > 0) {
    timeStr = hours > 0 ? `${days}天${hours}小时` : `${days}天`;
  } else {
    timeStr = `${Math.max(1, Math.floor(elapsedMs / 3600000))}小时`;
  }

  let title = 'PutPut: 规律排便提醒';
  let body = `距离上次排便已 ${timeStr}。今天记得适度走动、多喝温水，促进肠道蠕动哦 💧🥗`;

  if (data.healthCondition === 'blood') {
    title = 'PutPut: 肠道健康关注提醒';
    body = `距离上次排便已 ${timeStr}。近期排便记录伴随带血，如厕请勿久坐，若反复出现建议就医排查 🛑`;
  } else if (data.healthCondition === 'hard' || (data.lastBristol && data.lastBristol <= 2)) {
    title = 'PutPut: 肠道补水与膳食纤维提醒';
    body = `距离上次排便已 ${timeStr}。近几次便便偏硬 (Bristol 1-2)，今天记得多饮温水与补充膳食纤维 💧🥗`;
  } else if (data.healthCondition === 'loose' || (data.lastBristol && data.lastBristol >= 6)) {
    title = 'PutPut: 消化道调理提醒';
    body = `距离上次排便已 ${timeStr}。近期便型偏稀，注意清淡饮食并少量多次补充水分与电解质 💧`;
  }

  return { title, body, url: './' };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/status' || url.pathname === '/') {
      return new Response(JSON.stringify({
        service: 'PutPut Web Push Relay',
        status: 'online',
        vapidPublicKey: VAPID.publicKey,
        time: new Date().toISOString()
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/test-push' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { subscription, delaySeconds = 0, title, text } = body;
        if (!subscription || !subscription.endpoint || !subscription.keys) {
          return new Response(JSON.stringify({ error: 'Missing subscription or keys' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        let pushPayload;
        if (title && text) {
          pushPayload = { title, body: text, url: './' };
        } else {
          pushPayload = generateReminderMessage(body, Date.now());
        }

        if (delaySeconds > 0) {
          // Synchronously hold request open so Cloudflare Free Tier doesn't kill isolate
          await new Promise((r) => setTimeout(r, delaySeconds * 1000));
        }

        const result = await sendWebPush(subscription, pushPayload);
        return new Response(JSON.stringify({
          success: result.ok,
          apnsStatus: result.status,
          preview: pushPayload
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/schedule' && request.method === 'POST') {
      try {
        const { subscription, nextRemindAt, lastRecordTs, hours = 48, healthCondition, lastBristol } = await request.json();
        if (!subscription || !subscription.endpoint) {
          return new Response(JSON.stringify({ error: 'Missing subscription' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        if (env.PUTPUT_KV) {
          const key = `sub_${uint8ToBase64Url(base64UrlToUint8(subscription.keys.auth))}`;
          await env.PUTPUT_KV.put(key, JSON.stringify({
            subscription,
            nextRemindAt: nextRemindAt || (Date.now() + hours * 3600000),
            lastRecordTs: lastRecordTs || (Date.now() - hours * 3600000),
            hours,
            healthCondition,
            lastBristol,
            updatedAt: Date.now()
          }), {
            expirationTtl: 30 * 86400 // Keep for 30 days
          });
        }

        return new Response(JSON.stringify({ success: true, nextRemindAt }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  },

  // Cron trigger: Run every 30 minutes to check if any user needs a reminder
  async scheduled(event, env, ctx) {
    if (!env.PUTPUT_KV) return;
    const now = Date.now();
    const list = await env.PUTPUT_KV.list({ prefix: 'sub_' });

    for (const keyObj of list.keys) {
      const dataStr = await env.PUTPUT_KV.get(keyObj.name);
      if (!dataStr) continue;
      try {
        const data = JSON.parse(dataStr);
        if (data.nextRemindAt && data.nextRemindAt <= now) {
          const pushPayload = generateReminderMessage(data, now);
          await sendWebPush(data.subscription, pushPayload);

          // Throttle: Next reminder in 24 hours if still unlogged
          data.nextRemindAt = now + 24 * 3600000;
          await env.PUTPUT_KV.put(keyObj.name, JSON.stringify(data), {
            expirationTtl: 30 * 86400
          });
        }
      } catch (e) {
        console.error('Cron push error for key', keyObj.name, e);
      }
    }
  }
};
