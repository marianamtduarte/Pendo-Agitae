// Substituto mínimo de node:crypto para a demonstração no navegador.
// ATENÇÃO: usado só na demo estática (dados fictícios). O servidor real usa scrypt/HMAC nativos do Node.
import { Buffer } from 'buffer';

const primes = []; for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n);
const frac = (x) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
const K = primes.map((p) => frac(Math.cbrt(p)));
const H0 = primes.slice(0, 8).map((p) => frac(Math.sqrt(p)));

export function sha256(data) {
  const l = data.length, bits = l * 8, total = ((l + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total); buf.set(data); buf[l] = 0x80;
  const dv = new DataView(buf.buffer); dv.setUint32(total - 8, Math.floor(bits / 2 ** 32)); dv.setUint32(total - 4, bits >>> 0);
  let h = H0.slice(); const w = new Uint32Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4);
    for (let j = 16; j < 64; j++) {
      const a = w[j - 15], b = w[j - 2];
      w[j] = (w[j - 16] + (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + w[j - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let j = 0; j < 64; j++) {
      const t1 = (hh + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[j] + w[j]) >>> 0;
      const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h = [h[0] + a, h[1] + b, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map((x) => x >>> 0);
  }
  const out = new Uint8Array(32), odv = new DataView(out.buffer); h.forEach((x, i) => odv.setUint32(i * 4, x)); return out;
}

const toBuf = (x, enc) => (typeof x === 'string' ? Buffer.from(x, enc || 'utf8') : Buffer.from(x));
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encode = (bytes, enc) => { const b = Buffer.from(bytes); if (!enc) { const orig = b.toString.bind(b); b.toString = (e, ...r) => (e === 'base64url' ? b64url(b) : orig(e, ...r)); return b; } if (enc === 'base64url') return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); return b.toString(enc); };

class Hash {
  constructor(alg) { this.alg = alg; this.chunks = []; }
  update(d, enc) { this.chunks.push(toBuf(d, enc)); return this; }
  digest(enc) { let out = sha256(Buffer.concat(this.chunks)); if (this.alg === 'md5') out = out.slice(0, 16); return encode(out, enc); }
}
class Hmac {
  constructor(key) { let k = toBuf(key); if (k.length > 64) k = Buffer.from(sha256(k)); this.k = Buffer.concat([k, Buffer.alloc(64 - k.length)]); this.chunks = []; }
  update(d, enc) { this.chunks.push(toBuf(d, enc)); return this; }
  digest(enc) {
    const ipad = Buffer.from(this.k.map((b) => b ^ 0x36)), opad = Buffer.from(this.k.map((b) => b ^ 0x5c));
    const inner = sha256(Buffer.concat([ipad, ...this.chunks]));
    return encode(sha256(Buffer.concat([opad, Buffer.from(inner)])), enc);
  }
}
export const createHash = (alg) => new Hash(alg);
export const createHmac = (_alg, key) => new Hmac(key);
export function randomBytes(n) { const a = new Uint8Array(n); globalThis.crypto.getRandomValues(a); return encode(a); }
export function scryptSync(pw, salt, len) { // demo apenas: derivação por SHA-256 encadeado
  let out = Buffer.alloc(0), block = Buffer.from(sha256(Buffer.concat([toBuf(salt), toBuf(pw)])));
  while (out.length < len) { out = Buffer.concat([out, block]); block = Buffer.from(sha256(block)); }
  return out.subarray(0, len);
}
export function timingSafeEqual(a, b) { if (a.length !== b.length) throw new RangeError('tamanhos diferentes'); let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
export default { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual };
