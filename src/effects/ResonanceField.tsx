import { useEffect, useRef } from "react";

/**
 * ResonanceField — a full-bleed canvas of glowing particles that:
 *   • drift in a slow flow field
 *   • are repelled by the cursor
 *   • are pulled toward whatever <input>/<textarea>/<select> is focused
 *   • burst on keystroke at the focused field
 *   • emit shockwaves via window.dispatchEvent(new CustomEvent('resonance:shock', {detail: {x,y,hue}}))
 *   • implode + bloom via window.dispatchEvent(new CustomEvent('resonance:bloom'))
 *
 * No deps, respects prefers-reduced-motion (renders a single static gradient instead).
 */

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  life: number;        // 0..1, 1 = freshly bursted, decays linearly
  hue: number;         // 0..360
  size: number;        // base radius
  burst: boolean;      // true = burst particle, dies; false = ambient, immortal
};

type Shock = { x: number; y: number; r: number; max: number; hue: number; alpha: number };

const AMBIENT_COUNT = 180;

export function ResonanceField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const x = c.getContext("2d", { alpha: true });
    if (!x) return;
    const canvas: HTMLCanvasElement = c;
    const ctx: CanvasRenderingContext2D = x;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0, height = 0, dpr = 1;
    let raf = 0;
    let running = true;

    const particles: Particle[] = [];
    const shocks: Shock[] = [];
    let bloomT = -1;       // -1 idle, else seconds since bloom start
    let bloomCx = 0, bloomCy = 0;

    const mouse = { x: -9999, y: -9999, active: false };
    const focusTarget = { x: 0, y: 0, hue: 220, active: false };

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seedAmbient() {
      particles.length = 0;
      for (let i = 0; i < AMBIENT_COUNT; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          life: 1,
          hue: 215 + Math.random() * 60,  // indigo→violet baseline
          size: 2.2 + Math.random() * 2.6,
          burst: false,
        });
      }
    }

    function burstAt(x: number, y: number, hue: number, n: number, power: number) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (0.6 + Math.random() * 1.4) * power;
        particles.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 1,
          hue: hue + (Math.random() - 0.5) * 30,
          size: 0.8 + Math.random() * 1.6,
          burst: true,
        });
      }
      // Soft cap so we don't grow forever
      if (particles.length > AMBIENT_COUNT + 600) {
        // Remove oldest burst particles
        for (let i = particles.length - 1; i >= 0 && particles.length > AMBIENT_COUNT + 400; i--) {
          if (particles[i].burst) particles.splice(i, 1);
        }
      }
    }

    // Cheap pseudo-Perlin flow field — sum of a couple sines per axis.
    function flow(x: number, y: number, t: number): [number, number] {
      const nx = x * 0.0018;
      const ny = y * 0.0018;
      const a = Math.sin(nx * 1.7 + t * 0.10) + Math.cos(ny * 2.1 + t * 0.07);
      const b = Math.cos(nx * 2.3 - t * 0.09) + Math.sin(ny * 1.5 + t * 0.12);
      const angle = (a + b) * Math.PI * 0.5;
      return [Math.cos(angle), Math.sin(angle)];
    }

    function step(t: number) {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      ctx.globalCompositeOperation = "source-over";

      if (isDark) {
        // Dark mode: trail fade for a "glowing energy" feel, then additive blending
        ctx.fillStyle = "rgba(10, 12, 17, 0.14)";
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "lighter";
      } else {
        // Light mode: clear each frame for crisp, definitely-visible dots
        ctx.clearRect(0, 0, width, height);
      }

      const ts = t * 0.001;

      // Update + draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Flow field force
        const [fx, fy] = flow(p.x, p.y, ts);
        p.vx += fx * 0.015;
        p.vy += fy * 0.015;

        // Mouse repulsion
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 22500) { // 150px
            const d = Math.sqrt(d2) || 1;
            const force = (1 - d / 150) * 0.55;
            p.vx += (dx / d) * force;
            p.vy += (dy / d) * force;
          }
        }

        // Focus attraction
        if (focusTarget.active && !p.burst) {
          const dx = focusTarget.x - p.x;
          const dy = focusTarget.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          // Soft, distance-modulated pull — strong far away, eases up close so they orbit
          const pull = 0.0009 * Math.min(d, 600);
          p.vx += (dx / d) * pull;
          p.vy += (dy / d) * pull;
          // Pull color toward focus hue
          p.hue += (focusTarget.hue - p.hue) * 0.02;
        }

        // Bloom convergence then radial blast
        if (bloomT >= 0) {
          const dx = bloomCx - p.x;
          const dy = bloomCy - p.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (bloomT < 0.7) {
            // Implosion
            const k = 0.06 * (1 - bloomT / 0.7);
            p.vx += (dx / d) * k * d * 0.02;
            p.vy += (dy / d) * k * d * 0.02;
          } else {
            // Explosion (one-shot impulse on transition)
            // handled below
          }
        }

        // Damping
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap ambient particles
        if (!p.burst) {
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          if (p.y > height + 20) p.y = -20;
        }

        // Burst particles fade out
        if (p.burst) {
          p.life -= 0.012;
          if (p.life <= 0) { particles.splice(i, 1); continue; }
        }

        // Draw — radial-style glow via two stacked circles.
        // Light mode uses deeper, more saturated colors (no additive blending available).
        const a = p.burst ? p.life : 0.85;
        const r = p.size * (p.burst ? 1 + (1 - p.life) * 2 : 1);
        const haloL = isDark ? 65 : 55;
        const coreL = isDark ? 72 : 48;
        const haloAlpha = isDark ? 0.18 : 0.22;
        const coreAlpha = isDark ? 0.95 : 0.90;
        ctx.fillStyle = `hsla(${p.hue}, 90%, ${haloL}%, ${a * haloAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${p.hue}, 95%, ${coreL}%, ${a * coreAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shockwave rings
      ctx.globalCompositeOperation = "lighter";
      for (let i = shocks.length - 1; i >= 0; i--) {
        const s = shocks[i];
        s.r += (s.max - s.r) * 0.08;
        s.alpha *= 0.93;
        if (s.alpha < 0.02) { shocks.splice(i, 1); continue; }
        ctx.strokeStyle = `hsla(${s.hue}, 90%, 60%, ${s.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Bloom timeline
      if (bloomT >= 0) {
        const prev = bloomT;
        bloomT += 1 / 60;
        // Detonate at 0.7s
        if (prev < 0.7 && bloomT >= 0.7) {
          burstAt(bloomCx, bloomCy, 50, 240, 3.4);  // gold blast
          shocks.push({ x: bloomCx, y: bloomCy, r: 0, max: Math.max(width, height) * 0.9, hue: 48, alpha: 0.9 });
        }
        if (bloomT > 1.8) bloomT = -1;
      }

      if (running) raf = requestAnimationFrame(step);
    }

    function drawStatic() {
      // Reduced-motion fallback: a single subtle gradient wash.
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      ctx.clearRect(0, 0, width, height);
      const g = ctx.createRadialGradient(width * 0.3, height * 0.2, 0, width * 0.3, height * 0.2, Math.max(width, height));
      g.addColorStop(0, isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.10)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    // ---- Event wiring -----------------------------------------------------

    function onResize() {
      resize();
      if (reduced) drawStatic();
    }

    function onMouseMove(e: MouseEvent) {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    }
    function onMouseLeave() { mouse.active = false; }

    function isFormField(el: EventTarget | null): el is HTMLElement {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return false;
      return !!el.closest(".card");
    }

    function hueForField(el: HTMLElement): number {
      // Pick a hue per field name so each field "sings" a different note visually.
      const name = (el as HTMLInputElement).name || el.id || el.tagName;
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
      return ((h % 360) + 360) % 360;
    }

    function updateFocusTargetFrom(el: HTMLElement) {
      const r = el.getBoundingClientRect();
      focusTarget.x = r.left + r.width / 2;
      focusTarget.y = r.top + r.height / 2;
      focusTarget.hue = hueForField(el);
      focusTarget.active = true;
    }

    function onFocusIn(e: FocusEvent) {
      if (!isFormField(e.target)) return;
      updateFocusTargetFrom(e.target);
      // Gentle gather burst
      burstAt(focusTarget.x, focusTarget.y, focusTarget.hue, 14, 1.2);
    }
    function onFocusOut(e: FocusEvent) {
      if (!isFormField(e.target)) return;
      focusTarget.active = false;
    }

    function onInput(e: Event) {
      if (!isFormField(e.target)) return;
      updateFocusTargetFrom(e.target);
      burstAt(focusTarget.x, focusTarget.y, focusTarget.hue, 3, 0.9);
    }

    function onShock(e: Event) {
      const ce = e as CustomEvent<{ x: number; y: number; hue?: number }>;
      const d = ce.detail || { x: width / 2, y: height / 2 };
      const hue = d.hue ?? 8;
      shocks.push({ x: d.x, y: d.y, r: 0, max: 320, hue, alpha: 0.95 });
      burstAt(d.x, d.y, hue, 26, 1.6);
    }

    function onBloom(e: Event) {
      const ce = e as CustomEvent<{ x: number; y: number }>;
      const d = ce.detail || { x: width / 2, y: height / 2 };
      bloomCx = d.x; bloomCy = d.y;
      bloomT = 0;
    }

    function onScroll() {
      // Recompute focus target position as the page scrolls
      const el = document.activeElement;
      if (el instanceof HTMLElement && isFormField(el)) updateFocusTargetFrom(el);
    }

    // ---- Boot -------------------------------------------------------------

    resize();
    seedAmbient();

    if (reduced) {
      drawStatic();
    } else {
      raf = requestAnimationFrame(step);
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("input", onInput, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resonance:shock", onShock as EventListener);
    window.addEventListener("resonance:bloom", onBloom as EventListener);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("input", onInput, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resonance:shock", onShock as EventListener);
      window.removeEventListener("resonance:bloom", onBloom as EventListener);
    };
  }, []);

  return <canvas ref={canvasRef} className="resonance-canvas" aria-hidden="true" />;
}
