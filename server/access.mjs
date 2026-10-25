const COOKIE = 'dunzo-club-access';
const MAX_AGE = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();
async function keyFor(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
export async function matchesAccessKey(value, expected) {
  if (typeof value !== 'string' || value.length > 256 || !expected) return false;
  const key = await keyFor(expected);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(expected));
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(value));
}
export async function accessCookie(secret, secure = true, now = Date.now()) {
  const payload = `${now + MAX_AGE * 1000}.${crypto.randomUUID()}`;
  const signature = hex(await crypto.subtle.sign('HMAC', await keyFor(secret), encoder.encode(payload)));
  return `${COOKIE}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
}
export async function hasAccess(request, secret, now = Date.now()) {
  if (!secret) return false;
  const value = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [expires, nonce, signature, extra] = value.split('.');
  if (extra || !/^\d+$/.test(expires) || Number(expires) <= now || !/^[a-f0-9]{64}$/.test(signature || '') || !/^[a-f0-9-]{36}$/.test(nonce || '')) return false;
  const bytes = new Uint8Array(signature.match(/../g).map(n => parseInt(n, 16)));
  return crypto.subtle.verify('HMAC', await keyFor(secret), bytes, encoder.encode(`${expires}.${nonce}`));
}
