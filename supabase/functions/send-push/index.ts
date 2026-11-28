/**
 * send-push (SPEC §18.3) — drains notification_outbox to Firebase Cloud Messaging (HTTP v1).
 *
 * Triggered by a pg_net POST whenever rows are queued (plus a 5-minute sweep). It takes
 * no input: it claims a batch of unsent rows, sends them to each player's devices,
 * records failures and deletes tokens FCM reports as UNREGISTERED.
 *
 * Secrets: FCM_SERVICE_ACCOUNT_JSON (Firebase service-account key, set with
 * `supabase secrets set`). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

type OutboxRow = {
  id: number;
  user_id: string;
  kind: 'visible' | 'data';
  channel: string | null;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  collapse_key: string | null;
};
type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };

const serviceAccount: ServiceAccount = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') ?? '{}');
const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------- OAuth (cached ~55 min)
let cachedToken: { value: string; expiresAt: number } | null = null;

function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 300 > now) return cachedToken.value;

  const aud = serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token';
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud,
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const pem = serviceAccount.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));

  const res = await fetch(aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64url(signature)}` }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`oauth ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  cachedToken = { value: json.access_token, expiresAt: now + (json.expires_in ?? 3600) };
  return cachedToken.value;
}

// ---------------------------------------------------------------- FCM message shape
function fcmMessage(row: OutboxRow, token: string) {
  // FCM data values must be strings.
  const data = Object.fromEntries(Object.entries(row.data ?? {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  if (row.kind === 'data') {
    return { token, data, android: { priority: 'HIGH', ...(row.collapse_key ? { collapse_key: row.collapse_key } : {}) } };
  }
  return {
    token,
    data,
    notification: { title: row.title ?? '', body: row.body ?? '' },
    android: {
      priority: 'HIGH',
      ...(row.collapse_key ? { collapse_key: row.collapse_key } : {}),
      // `notification_icon` is the white padlock the app ships in res/drawable (plugins/withNotifications.js).
      notification: { channel_id: row.channel ?? 'group', icon: 'notification_icon', color: '#2F7BFF' },
    },
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async () => {
  if (!serviceAccount.private_key) return json({ error: 'FCM_SERVICE_ACCOUNT_JSON is not set' }, 500);

  const { data: rows, error } = await db.rpc('claim_outbox', { p_limit: 100 });
  if (error) return json({ error: error.message }, 500);
  const batch = (rows ?? []) as OutboxRow[];
  if (!batch.length) return json({ sent: 0 });

  const userIds = [...new Set(batch.map((r) => r.user_id))];
  const { data: tokens, error: tokenError } = await db.from('device_tokens').select('token, user_id').in('user_id', userIds);
  if (tokenError) return json({ error: tokenError.message }, 500);

  let bearer: string;
  try {
    bearer = await accessToken();
  } catch (e) {
    await db.from('notification_outbox').update({ error: String(e).slice(0, 300) }).in('id', batch.map((r) => r.id));
    return json({ error: String(e) }, 500);
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
  const dead = new Set<string>();
  let delivered = 0;

  for (const row of batch) {
    const mine = (tokens ?? []).filter((t) => t.user_id === row.user_id);
    let failure: string | null = mine.length ? null : 'no_device';
    for (const { token } of mine) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fcmMessage(row, token) }),
      });
      if (res.ok) {
        delivered++;
        continue;
      }
      const text = await res.text();
      // Expired, uninstalled or malformed tokens: forget them.
      if (res.status === 404 || text.includes('UNREGISTERED') || (res.status === 400 && text.includes('registration token'))) dead.add(token);
      else failure = `${res.status} ${text.slice(0, 250)}`;
    }
    if (failure) await db.from('notification_outbox').update({ error: failure }).eq('id', row.id);
  }

  if (dead.size) await db.from('device_tokens').delete().in('token', [...dead]);
  return json({ rows: batch.length, delivered, removedTokens: dead.size });
});
