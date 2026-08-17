/** Join / magic-link codes: 10 chars, unambiguous alphabet (no 0/O, 1/I/L). */
export const JOIN_CODE_LENGTH = 10;
export const JOIN_CODE_MIN = 6;
export const JOIN_CODE_MAX = 16;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeJoinCode(raw: string | undefined | null): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isValidJoinCode(code: string): boolean {
  const c = normalizeJoinCode(code);
  return c.length >= JOIN_CODE_MIN && c.length <= JOIN_CODE_MAX && /^[A-Z0-9]+$/.test(c);
}

export function eventSharePath(code: string): string {
  return `/e/${normalizeJoinCode(code)}`;
}

export function eventShareUrl(code: string, origin?: string): string {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}${eventSharePath(code)}`;
}

/** Browser-side generator (display only — server is source of truth). */
export function generateJoinCode(length = JOIN_CODE_LENGTH): string {
  const n = Math.min(JOIN_CODE_MAX, Math.max(JOIN_CODE_MIN, length));
  let s = '';
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : null;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint8Array(n);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < n; i++) s += ALPHABET[buf[i]! % ALPHABET.length];
    return s;
  }
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
