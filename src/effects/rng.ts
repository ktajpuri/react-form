// FNV-1a 32-bit string hash. Stable across runs and platforms.
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 PRNG — small, fast, decent distribution.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngRange(rng: () => number, lo: number, hi: number): number {
  return lo + (hi - lo) * rng();
}

export function rngInt(rng: () => number, lo: number, hi: number): number {
  return Math.floor(rngRange(rng, lo, hi + 1));
}

export function rngPick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

// 4-char uppercase hex "fingerprint" pair like "A4F7-2B91" derived from the seed.
export function fingerprint(seed: number): string {
  const a = (seed & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  const b = ((seed >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  return `${a}-${b}`;
}
