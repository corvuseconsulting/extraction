/**
 * Extraction Engine — Email capture (ConvertKit)
 * Netlify Functions v2
 *
 * Route: POST /api/subscribe
 * Body:  { email: string }
 *
 * Env vars required:
 *   CONVERTKIT_API_KEY   — your ConvertKit v3 API key
 *   CONVERTKIT_FORM_ID   — the form ID to subscribe to
 *
 * Graceful degradation: if env vars are missing, the request
 * succeeds with a console.log so the ceiling UX never breaks
 * during development or before ConvertKit is wired.
 */

export default async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  // Parse body
  let email;
  try {
    const body = await req.json();
    email = body.email;
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders() });
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return new Response('Missing or invalid email', { status: 400, headers: corsHeaders() });
  }

  email = email.trim().toLowerCase();

  const API_KEY = process.env.CONVERTKIT_API_KEY;
  const FORM_ID = process.env.CONVERTKIT_FORM_ID;

  // Graceful degradation — succeed without ConvertKit in dev/staging
  if (!API_KEY || !FORM_ID) {
    console.log('[subscribe] ConvertKit env vars not set. Captured email (dev mode):', email);
    return json({ success: true });
  }

  try {
    const ckRes = await fetch(
      `https://api.convertkit.com/v3/forms/${FORM_ID}/subscribe`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: API_KEY,
          email,
          tags: ['extraction-engine'],
        }),
      }
    );

    if (!ckRes.ok) {
      const text = await ckRes.text();
      console.error('[subscribe] ConvertKit error:', ckRes.status, text);
      return new Response('Subscription failed', { status: 502, headers: corsHeaders() });
    }

    return json({ success: true });
  } catch (err) {
    console.error('[subscribe] Fetch error:', err);
    return new Response('Internal error', { status: 500, headers: corsHeaders() });
  }
};

export const config = { path: '/api/subscribe' };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
