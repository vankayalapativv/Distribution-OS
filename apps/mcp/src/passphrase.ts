/**
 * Constant-time string comparison for the MCP gate's shared secrets (the access
 * passphrase and the admin bearer token). Workers-native — no Node built-ins.
 * Comparing in constant time avoids leaking length/prefix info via timing.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return timingSafeEqual(enc.encode(a), enc.encode(b));
}
