import { useMemo, useRef } from "react";
import type { Values } from "../types";
import { hashString, mulberry32, rngInt, rngRange, fingerprint } from "./rng";

/**
 * IdentityCard — a generative SVG artwork that is a *deterministic* function
 * of the values the user submitted. The same inputs always produce the same
 * card; tweak any character and you get a new one.
 *
 * Design:
 *   • a unique rose/spirograph "signature glyph" parametrized by the seed
 *   • an orbit of concentric arcs whose dash patterns are seed-driven
 *   • a personalized typographic block (name, plan/role, fingerprint)
 *   • a tiny waveform line derived from the user's bio
 *
 * The same component renders both the on-screen card and the downloadable SVG.
 */

type Props = {
  values: Values;
  id: string;
  onReset: () => void;
};

const W = 460;
const H = 620;

export function IdentityCard({ values, id, onReset }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const art = useMemo(() => buildArt(values, id), [values, id]);

  function handleDownload() {
    const svg = svgRef.current;
    if (!svg) return;
    const cloned = svg.cloneNode(true) as SVGSVGElement;
    cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob(
      ['<?xml version="1.0" encoding="UTF-8"?>\n', new XMLSerializer().serializeToString(cloned)],
      { type: "image/svg+xml;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resonance-${art.fp.replace("-", "")}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="reveal">
      <div className="reveal-card" role="group" aria-label="Your Resonance card">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          xmlns="http://www.w3.org/2000/svg"
          className="reveal-svg"
        >
          <defs>
            <radialGradient id={`bg-${art.fp}`} cx="50%" cy="35%" r="75%">
              <stop offset="0%" stopColor={art.palette.bgInner} />
              <stop offset="100%" stopColor={art.palette.bgOuter} />
            </radialGradient>
            <linearGradient id={`stroke-${art.fp}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={art.palette.glyph1} />
              <stop offset="100%" stopColor={art.palette.glyph2} />
            </linearGradient>
            <filter id={`glow-${art.fp}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect x="0" y="0" width={W} height={H} rx="20" fill={`url(#bg-${art.fp})`} />

          {/* Subtle starfield */}
          <g opacity="0.6">
            {art.stars.map((s, i) => (
              <circle key={`s-${i}`} cx={s.x} cy={s.y} r={s.r} fill={art.palette.star} />
            ))}
          </g>

          {/* Orbital rings */}
          <g transform={`translate(${W / 2} ${H / 2 - 60})`} opacity="0.45">
            {art.rings.map((r, i) => (
              <circle
                key={`r-${i}`}
                r={r.radius}
                fill="none"
                stroke={art.palette.ring}
                strokeWidth={r.w}
                strokeDasharray={r.dash}
                opacity={r.opacity}
              />
            ))}
          </g>

          {/* The signature glyph */}
          <g transform={`translate(${W / 2} ${H / 2 - 60})`} filter={`url(#glow-${art.fp})`}>
            <path
              d={art.glyph}
              fill="none"
              stroke={`url(#stroke-${art.fp})`}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
          </g>

          {/* Header band */}
          <g>
            <text
              x="28"
              y="42"
              fill={art.palette.muted}
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontSize="10"
              letterSpacing="2"
            >
              RESONANCE · IDENTITY
            </text>
            <text
              x={W - 28}
              y="42"
              textAnchor="end"
              fill={art.palette.muted}
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontSize="10"
              letterSpacing="2"
            >
              {art.fp}
            </text>
          </g>

          {/* Name + meta block */}
          <g>
            <text
              x={W / 2}
              y={H - 150}
              textAnchor="middle"
              fill={art.palette.text}
              fontFamily="'Inter', system-ui, sans-serif"
              fontSize="26"
              fontWeight="700"
              letterSpacing="-0.5"
            >
              {truncate(art.name, 28)}
            </text>
            <text
              x={W / 2}
              y={H - 124}
              textAnchor="middle"
              fill={art.palette.muted}
              fontFamily="'Inter', system-ui, sans-serif"
              fontSize="12"
              letterSpacing="1"
            >
              {art.subtitle.toUpperCase()}
            </text>
          </g>

          {/* Bio waveform */}
          <g transform={`translate(${W / 2 - 140}, ${H - 86})`}>
            <path
              d={art.wave}
              fill="none"
              stroke={art.palette.glyph2}
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.8"
            />
          </g>

          {/* Footer */}
          <g>
            <text
              x="28"
              y={H - 28}
              fill={art.palette.muted}
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontSize="9.5"
              letterSpacing="1.5"
            >
              ISSUED · {art.issued}
            </text>
            <text
              x={W - 28}
              y={H - 28}
              textAnchor="end"
              fill={art.palette.muted}
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontSize="9.5"
              letterSpacing="1.5"
            >
              {id}
            </text>
          </g>
        </svg>
      </div>

      <div className="reveal-meta">
        <p className="reveal-line">
          A unique artwork, generated from the exact characters you entered.
          Change a single letter and you get a different card forever.
        </p>
        <div className="reveal-actions">
          <button type="button" className="reveal-download" onClick={handleDownload}>
            Download SVG
          </button>
          <button type="button" className="reveal-reset" onClick={onReset}>
            Start over
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Generative logic
// ---------------------------------------------------------------------------

type Palette = {
  bgInner: string;
  bgOuter: string;
  glyph1: string;
  glyph2: string;
  ring: string;
  star: string;
  text: string;
  muted: string;
};

function buildArt(values: Values, id: string) {
  // Stable seed: all input characters matter.
  const seedSource = JSON.stringify(serializeForSeed(values)) + "|" + id;
  const seed = hashString(seedSource);
  const rng = mulberry32(seed);
  const fp = fingerprint(seed);

  const palette = buildPalette(rng);

  // Signature glyph: a rose/lissajous hybrid.
  // r = R * (cos(k*θ) + amp*sin(m*θ)), traced over multiple turns.
  const k = rngInt(rng, 3, 9);            // petals
  const m = rngInt(rng, 2, 7);            // harmonic
  const amp = rngRange(rng, 0.15, 0.45);
  const R = rngRange(rng, 110, 150);
  const turns = rngInt(rng, 3, 6);
  const phase = rngRange(rng, 0, Math.PI * 2);

  const STEPS = 1400;
  let path = "";
  for (let i = 0; i <= STEPS; i++) {
    const tt = (i / STEPS) * Math.PI * 2 * turns;
    const r = R * (Math.cos(k * tt + phase) + amp * Math.sin(m * tt));
    const x = Math.cos(tt) * r;
    const y = Math.sin(tt) * r;
    path += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }

  // Orbit rings
  const ringCount = rngInt(rng, 3, 5);
  const rings = Array.from({ length: ringCount }, (_, i) => ({
    radius: 165 + i * 14 + rngRange(rng, -4, 4),
    w: rngRange(rng, 0.5, 1.4),
    dash: `${rngInt(rng, 1, 6)} ${rngInt(rng, 4, 16)}`,
    opacity: 0.25 + rng() * 0.35,
  }));

  // Starfield
  const stars = Array.from({ length: 60 }, () => ({
    x: rngRange(rng, 12, W - 12),
    y: rngRange(rng, 12, H - 12),
    r: rngRange(rng, 0.3, 1.1),
  }));

  // Bio waveform
  const bio = String(values.bio || "").trim() || "no signal";
  const wave = bioWave(bio, 280, 28);

  // Identity strings
  const name = String(values.fullName || "Anonymous").trim() || "Anonymous";
  const tier = String(values.tier || "").trim();
  const role = String(values.role || "").trim();
  const subtitle =
    [tier && `${cap(tier)} plan`, role && `${cap(role)} role`].filter(Boolean).join(" · ") ||
    "Member";

  const issued = new Date().toISOString().slice(0, 10);

  return { palette, glyph: path, rings, stars, wave, name, subtitle, fp, issued };
}

function buildPalette(rng: () => number): Palette {
  const baseHue = Math.floor(rng() * 360);
  const accentHue = (baseHue + 35 + Math.floor(rng() * 80)) % 360;
  return {
    bgInner: `hsl(${(baseHue + 200) % 360}, 25%, 13%)`,
    bgOuter: `hsl(${(baseHue + 240) % 360}, 30%, 6%)`,
    glyph1:  `hsl(${baseHue}, 95%, 70%)`,
    glyph2:  `hsl(${accentHue}, 95%, 72%)`,
    ring:    `hsl(${baseHue}, 60%, 70%)`,
    star:    `hsl(${baseHue}, 30%, 85%)`,
    text:    `hsl(${baseHue}, 30%, 96%)`,
    muted:   `hsl(${baseHue}, 20%, 70%)`,
  };
}

function serializeForSeed(v: Values): Record<string, unknown> {
  // Strip the avatar data URL — it's huge and would dominate the hash space.
  // We still incorporate its length so different uploads produce different art.
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string" && val.startsWith("data:image/")) {
      out[k] = `image:${val.length}`;
    } else {
      out[k] = val;
    }
  }
  return out;
}

function bioWave(text: string, width: number, height: number): string {
  // Sample 64 points; amplitude at each point is the char code modulo something.
  const N = 64;
  let path = "";
  const codes = Array.from(text).map((c) => c.charCodeAt(0));
  for (let i = 0; i <= N; i++) {
    const tt = i / N;
    const idx = Math.floor(tt * codes.length);
    const c = codes[Math.min(idx, codes.length - 1)] || 0;
    const y = (Math.sin(tt * Math.PI * 8 + c * 0.03) * 0.5 + 0.5) * height - height / 2;
    const x = tt * width;
    path += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return path;
}

function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
