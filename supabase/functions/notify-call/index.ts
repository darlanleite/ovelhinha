import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import webpush from "npm:web-push@3.6.7";

// Origens permitidas: configure ALLOWED_ORIGINS (separadas por vírgula) nos
// secrets da função. Localhost é liberado para desenvolvimento.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://ovelhinha.vercel.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// ─── Helpers base64url ────────────────────────────────────────────────────────
function b64urlToBytes(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── VAPID JWT via Deno crypto.subtle ─────────────────────────────────────────
async function buildVapidJwt(
  endpoint: string,
  vapidPubB64: string,
  vapidPrivB64: string,
  subject: string
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 43200;

  const header = bytesToB64url(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  );
  const payload = bytesToB64url(
    new TextEncoder().encode(JSON.stringify({ aud, sub: subject, exp }))
  );
  const input = `${header}.${payload}`;

  const pubBytes = b64urlToBytes(vapidPubB64.trim());
  const x = bytesToB64url(pubBytes.slice(1, 33));
  const y = bytesToB64url(pubBytes.slice(33, 65));
  const d = vapidPrivB64.trim().replace(/=/g, '');

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d, x, y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(input)
  );

  return `${input}.${bytesToB64url(new Uint8Array(sig))}`;
}

// ─── RFC 8291 payload encryption (aes128gcm) ──────────────────────────────────
async function encryptPayload(
  plaintext: Uint8Array,
  p256dhB64: string,
  authB64: string
): Promise<Uint8Array> {
  const receiverPubBytes = b64urlToBytes(p256dhB64);
  const authSecret = b64urlToBytes(authB64);

  const senderPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const senderPubBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', senderPair.publicKey)
  );

  const receiverPubKey = await crypto.subtle.importKey(
    'raw', receiverPubBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const dh = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: receiverPubKey }, senderPair.privateKey, 256
    )
  );

  const dhKey = await crypto.subtle.importKey('raw', dh, 'HKDF', false, ['deriveBits']);
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\x00'),
    ...receiverPubBytes,
    ...senderPubBytes,
  ]);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyInfo },
      dhKey, 256
    )
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const ikmKey1 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const ikmKey2 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cekBytes = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('Content-Encoding: aes128gcm\x00') },
      ikmKey1, 128
    )
  );
  const nonceBytes = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('Content-Encoding: nonce\x00') },
      ikmKey2, 96
    )
  );

  const cekKey = await crypto.subtle.importKey('raw', cekBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonceBytes, tagLength: 128 },
      cekKey,
      new Uint8Array([...plaintext, 2])
    )
  );

  const rs = 4096;
  const body = new Uint8Array(86 + ciphertext.length);
  let off = 0;
  body.set(salt, off); off += 16;
  body[off++] = (rs >>> 24) & 0xff; body[off++] = (rs >>> 16) & 0xff;
  body[off++] = (rs >>> 8) & 0xff;  body[off++] = rs & 0xff;
  body[off++] = 65;
  body.set(senderPubBytes, off); off += 65;
  body.set(ciphertext, off);
  return body;
}

// ─── Apple Web Push ───────────────────────────────────────────────────────────
async function sendApplePush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPub: string,
  vapidPriv: string,
  vapidSubject: string
): Promise<void> {
  const jwt = await buildVapidJwt(subscription.endpoint, vapidPub, vapidPriv, vapidSubject);
  const body = await encryptPayload(
    new TextEncoder().encode(payload),
    subscription.keys.p256dh,
    subscription.keys.auth
  );
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidPub}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
    body,
  });
  if (!res.ok) {
    const resBody = await res.text();
    const err = new Error('Received unexpected response code') as Error & { statusCode: number; body: string };
    err.statusCode = res.status;
    err.body = resBody;
    throw err;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!.trim();
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!.trim();
    const vapidSubject = (Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@ovelhinha.app').trim();

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── Autenticação: usuário logado (staff/tia) ou chamada interna
    //    do banco (pg_cron) autenticada com a service key ──
    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
    const isSystemCall = bearerToken === supabaseServiceKey;

    let church_id: string | null = null;

    if (!isSystemCall) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await supabaseAuth.auth.getUser();
      const user = userData?.user;
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
        });
      }

      // Igreja derivada da identidade do chamador (não confia no body)
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('church_id').eq('user_id', user.id).maybeSingle();
      if (profile) {
        church_id = profile.church_id;
      } else {
        const { data: tia } = await supabaseAdmin
          .from('tia_sessions').select('church_id, expires_at').eq('user_id', user.id).maybeSingle();
        if (tia && new Date(tia.expires_at).getTime() > Date.now()) {
          church_id = tia.church_id;
        }
      }
      if (!church_id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
        });
      }
    }

    const { type, child_name, bracelet_number, reason, room_id, gateway_name, church_id: bodyChurch } = await req.json();
    if (isSystemCall) church_id = bodyChurch ?? null;
    if (!church_id) {
      return new Response(JSON.stringify({ error: 'Missing church_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    if (!type) {
      return new Response(JSON.stringify({ error: 'Missing type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    // Determine target role and notification content based on event type
    let targetRole: string;
    let title: string;
    let body: string;

    if (type === 'gateway_offline') {
      // Só o vigia do banco (pg_cron) pode disparar este tipo
      if (!isSystemCall) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
        });
      }
      targetRole = 'reception';
      title = `⚠️ Gateway offline`;
      body = `${gateway_name ?? 'Gateway'} parou de responder — as pulseiras podem não receber comandos`;
    } else if (type === 'call_created') {
      targetRole = 'reception';
      title = `🐑 Pulseira #${bracelet_number} acionada`;
      body = reason ? `${child_name} · ${reason}` : child_name;
    } else if (type === 'call_answered') {
      targetRole = 'tia';
      title = `🐑 Pai de ${child_name} chegou!`;
      body = 'Respondido pela recepção';
    } else {
      return new Response(JSON.stringify({ error: 'Unknown type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    // Query subscriptions
    let query = supabaseAdmin
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('church_id', church_id)
      .eq('role', targetRole);

    // For tia, filter by room_id if provided (also include tias with no room set)
    if (type === 'call_answered' && room_id) {
      query = query.or(`room_id.eq.${room_id},room_id.is.null`);
    }

    const { data: subscriptions } = await query;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      tag: `call-${type}`,
      url: type === 'gateway_offline' ? '/configuracoes' : type === 'call_created' ? '/acionar' : '/tia',
    });

    let sent = 0;
    const staleIds: string[] = [];
    const errors: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub: { id: string; subscription: PushSubscriptionJSON }) => {
        const endpoint = (sub.subscription as { endpoint?: string }).endpoint || '';
        const isApple = endpoint.includes('web.push.apple.com');
        try {
          if (isApple) {
            const keys = (sub.subscription as { keys?: { p256dh: string; auth: string } }).keys!;
            await sendApplePush({ endpoint, keys }, payload, vapidPublicKey, vapidPrivateKey, vapidSubject);
          } else {
            await webpush.sendNotification(sub.subscription as webpush.PushSubscription, payload);
          }
          sent++;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          const errMsg = (err as { message?: string }).message || String(err);
          const errBody = (err as { body?: string }).body || '';
          errors.push(`[${isApple ? 'apple' : 'fcm'}] status=${statusCode} msg=${errMsg} body=${errBody}`);
          if (statusCode === 410 || statusCode === 404 || statusCode === 403) {
            staleIds.push(sub.id);
          }
        }
      })
    );

    if (staleIds.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('id', staleIds);
    }

    return new Response(
      JSON.stringify({ sent, stale_removed: staleIds.length, subscriptions_found: subscriptions.length, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
