// ==============================================================================
// FUNCTION: get-turn-credentials
// DESCRIPTION: Securely distributes ephemeral STUN/TURN ICE server credentials.
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/supabaseClient.ts';

// Helper for HMAC-SHA1 for Coturn ephemeral REST API credentials
async function generateCoturnCredentials(secret: string, usernamePrefix: string, ttlSeconds: number = 86400) {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiry}:${usernamePrefix}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(username));
  const credential = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return { username, credential };
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user } = await getAuthenticatedUser(req);

    // STUN Servers (always safe and public)
    const stunUrls = (Deno.env.get('STUN_URLS') || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
      { urls: stunUrls },
    ];

    const turnUrls = Deno.env.get('TURN_URLS');
    const turnSecret = Deno.env.get('TURN_STATIC_AUTH_SECRET');
    const turnStaticUser = Deno.env.get('TURN_USERNAME');
    const turnStaticPass = Deno.env.get('TURN_CREDENTIAL');

    if (turnUrls) {
      const urls = turnUrls.split(',').map((u) => u.trim());

      if (turnSecret) {
        // Option A: Coturn Ephemeral Credentials (HMAC-SHA1 time-limited)
        const { username, credential } = await generateCoturnCredentials(turnSecret, user.id, 3600);
        iceServers.push({
          urls,
          username,
          credential,
        });
      } else if (turnStaticUser && turnStaticPass) {
        // Option B: Managed static credentials securely proxied by backend
        iceServers.push({
          urls,
          username: turnStaticUser,
          credential: turnStaticPass,
        });
      }
    }

    return new Response(
      JSON.stringify({
        iceServers,
        ttl: 3600,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

