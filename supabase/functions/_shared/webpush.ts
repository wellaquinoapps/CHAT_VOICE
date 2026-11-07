// ==============================================================================
// FILE: supabase/functions/_shared/webpush.ts
// DESCRIPTION: Web Push notification delivery utility with VAPID authorization.
// ==============================================================================

interface PushSubscriptionData {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

// Convert base64 / base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convert Uint8Array to base64url string
function uint8ArrayToBase64Url(array: Uint8Array): string {
  let str = '';
  for (let i = 0; i < array.length; i++) {
    str += String.fromCharCode(array[i]);
  }
  return btoa(str)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Creates a signed VAPID Authorization header (RFC 8292) using Web Crypto API.
 */
async function createVapidHeader(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<string> {
  const header = {
    alg: 'ES256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const message = `${headerB64}.${payloadB64}`;

  // Import PKCS#8 or JWK private key
  const privKeyRaw = base64UrlToUint8Array(privateKey);
  
  // Import ECDSA P-256 private key for signing
  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      privKeyRaw,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  } catch (_e) {
    // If not direct PKCS8, create an importable structure or fallback
    cryptoKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        d: privateKey,
        x: publicKey.slice(0, 43),
        y: publicKey.slice(43),
        ext: false,
      },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  }

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    cryptoKey,
    new TextEncoder().encode(message)
  );

  const signatureB64 = uint8ArrayToBase64Url(new Uint8Array(signature));
  const jwt = `${message}.${signatureB64}`;

  return `vapid t=${jwt}, k=${publicKey}`;
}

/**
 * Send Web Push notification to a single device subscription.
 * Returns { success: boolean, expired: boolean, status: number }
 */
export async function sendWebPushNotification(
  sub: PushSubscriptionData,
  payload: PushPayload
): Promise<{ success: boolean; expired: boolean; status: number; error?: string }> {
  try {
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@privateline.local';
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured. Skipping push notification.');
      return { success: false, expired: false, status: 500, error: 'VAPID keys not configured' };
    }

    const endpointUrl = new URL(sub.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    let authHeader = '';
    try {
      authHeader = await createVapidHeader(audience, vapidSubject, vapidPublicKey, vapidPrivateKey);
    } catch (err) {
      console.error('Error generating VAPID signature:', err);
      // Fallback simple Authorization if direct ES256 fails in specific environment
      authHeader = `vapid k=${vapidPublicKey}`;
    }

    const bodyString = JSON.stringify(payload);

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'TTL': '86400', // 24 hours
        'Content-Type': 'application/json',
      },
      body: bodyString,
    });

    if (res.status === 201 || res.status === 200 || res.status === 202) {
      return { success: true, expired: false, status: res.status };
    }

    // 404 Not Found or 410 Gone indicates the push subscription has expired/been revoked
    if (res.status === 404 || res.status === 410) {
      return { success: false, expired: true, status: res.status };
    }

    const resText = await res.text();
    return { success: false, expired: false, status: res.status, error: resText };
  } catch (err: any) {
    return { success: false, expired: false, status: 500, error: err.message };
  }
}

