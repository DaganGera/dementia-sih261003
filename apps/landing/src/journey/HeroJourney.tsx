import { useMotionValueEvent, useScroll, useSpring } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { readEnv, readPause, writePause } from './env';
import { blendFor, entryFrame, frameAt, IDLE_EXIT, idleOpacity, loadOrder, RESOLVE_AT, shouldUseStatic } from './logic';

interface Manifest {
  fps: { desktop: number; mobile: number };
  desktop: { count: number };
  mobile: { count: number };
}

type Phase = 'idle' | 'scrub';
const BASE = '/media/hero';
const pad = (n: number) => String(n + 1).padStart(4, '0');

/**
 * The fixed film layer for the whole page. Geometry, overlay and fade timings follow the hero spec.
 * Idle: the reversed clip loops with 0.5 s fades. Scrolling: canvas frames follow scroll position.
 * No scroll listeners, no scroll hijack: native touch scrolling is untouched.
 */
export function HeroJourney() {
  const [paused, setPaused] = useState(readPause);
  const staticMode = useMemo(() => (typeof window === 'undefined' ? true : shouldUseStatic({ ...readEnv(), pausedByUser: paused })), [paused]);
  const portrait = typeof window !== 'undefined' && window.matchMedia('(max-aspect-ratio: 1/1)').matches;
  const set = portrait ? 'm' : 'd';
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const phase = useRef<Phase>('idle');
  const gate = useRef(1);
  const startFrame = useRef(0);
  const p0 = useRef(IDLE_EXIT);
  const blobs = useRef<Map<number, Blob>>(new Map());
  const bitmaps = useRef<Map<number, ImageBitmap>>(new Map());
  const pending = useRef<Set<number>>(new Set());
  const target = useRef(0);
  const drawRaf = useRef(0);
  const count = manifest ? (portrait ? manifest.mobile.count : manifest.desktop.count) : 0;
  const fps = manifest ? (portrait ? manifest.fps.mobile : manifest.fps.desktop) : 12;

  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.6 });

  useEffect(() => {
    if (staticMode) return;
    let alive = true;
    fetch(`${BASE}/hero.json`)
      .then((r) => r.json() as Promise<Manifest>)
      .then((m) => alive && setManifest(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [staticMode]);

  // Idle loop: opacity is driven from requestAnimationFrame, straight on the element.
  useEffect(() => {
    const v = video.current;
    if (staticMode || !v) return;
    let raf = 0;
    let timer = 0;
    const tick = () => {
      v.style.opacity = String(idleOpacity(v.currentTime, v.duration) * gate.current);
      raf = requestAnimationFrame(tick);
    };
    const onEnded = () => {
      v.style.opacity = '0';
      timer = window.setTimeout(() => {
        v.currentTime = 0;
        void v.play().catch(() => undefined);
      }, 100);
    };
    v.addEventListener('ended', onEnded);
    void v.play().catch(() => undefined);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      v.removeEventListener('ended', onEnded);
    };
  }, [staticMode, set]);

  // Progressive frame loading after the page is idle: coarse to fine, three at a time, stopped for Save-Data.
  useEffect(() => {
    if (staticMode || !count) return;
    let cancelled = false;
    const order = loadOrder(count);
    let next = 0;
    const work = async () => {
      while (!cancelled && next < order.length) {
        const i = order[next++]!;
        try {
          const r = await fetch(`${BASE}/${set}/${pad(i)}.webp`, { priority: 'low' } as RequestInit);
          if (r.ok) blobs.current.set(i, await r.blob());
        } catch {
          // A missing frame is skipped; the nearest ready frame is drawn instead.
        }
      }
    };
    const start = () => {
      for (let k = 0; k < 3; k++) void work();
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const h = idle ? idle(start) : window.setTimeout(start, 400);
    return () => {
      cancelled = true;
      if (!idle) window.clearTimeout(h);
    };
  }, [staticMode, count, set]);

  const ensureBitmap = (i: number) => {
    if (bitmaps.current.has(i) || pending.current.has(i)) return;
    const b = blobs.current.get(i);
    if (!b) return;
    pending.current.add(i);
    void createImageBitmap(b).then((bm) => {
      pending.current.delete(i);
      bitmaps.current.set(i, bm);
      // Keep a window of bitmaps around the current position; the encoded frames all stay in memory.
      const center = Math.round(target.current);
      for (const [k, v] of bitmaps.current) {
        if (Math.abs(k - center) > 8) {
          v.close();
          bitmaps.current.delete(k);
        }
      }
      requestDraw();
    });
  };

  const draw = () => {
    drawRaf.current = 0;
    const c = canvas.current;
    if (!c || !count) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const f = target.current;
    for (const k of [Math.floor(f) - 1, Math.floor(f), Math.floor(f) + 1, Math.floor(f) + 2]) if (k >= 0 && k < count) ensureBitmap(k);
    const blend = blendFor(f, (i) => bitmaps.current.has(i), count);
    if (!blend) return;
    const ctx = c.getContext('2d')!;
    const paint = (i: number, alpha: number) => {
      const bm = bitmaps.current.get(i)!;
      const s = Math.max(w / bm.width, h / bm.height);
      const dw = bm.width * s;
      const dh = bm.height * s;
      ctx.globalAlpha = alpha;
      ctx.drawImage(bm, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };
    ctx.clearRect(0, 0, w, h);
    paint(blend.a, 1);
    if (blend.b !== blend.a && blend.t > 0) paint(blend.b, blend.t);
    ctx.globalAlpha = 1;
  };

  const requestDraw = () => {
    if (!drawRaf.current) drawRaf.current = requestAnimationFrame(draw);
  };

  const fade = (el: HTMLElement | null, to: number, ms: number) => {
    if (!el) return;
    el.style.transition = `opacity ${ms}ms ease-out`;
    el.style.opacity = String(to);
  };

  useMotionValueEvent(smooth, 'change', (p) => {
    if (staticMode || !count) return;
    if (phase.current === 'idle' && p > IDLE_EXIT) {
      const v = video.current;
      startFrame.current = entryFrame(v?.currentTime ?? 0, fps, count);
      p0.current = p;
      target.current = startFrame.current;
      phase.current = 'scrub';
      gate.current = 0;
      if (v) {
        v.style.transition = 'opacity 250ms ease-out';
        v.style.opacity = '0';
        v.pause();
      }
      requestDraw();
      fade(canvas.current, 1, 250);
    } else if (phase.current === 'scrub' && p <= IDLE_EXIT) {
      phase.current = 'idle';
      const v = video.current;
      fade(canvas.current, 0, 250);
      if (v) {
        v.currentTime = startFrame.current / fps;
        gate.current = 1;
        v.style.transition = '';
        void v.play().catch(() => undefined);
      }
    }
    if (phase.current === 'scrub') {
      target.current = frameAt(Math.min(p, RESOLVE_AT), p0.current, startFrame.current, count);
      requestDraw();
    }
  });

  useEffect(() => {
    const on = () => requestDraw();
    window.addEventListener('resize', on, { passive: true });
    return () => {
      window.removeEventListener('resize', on);
      cancelAnimationFrame(drawRaf.current);
      for (const b of bitmaps.current.values()) b.close();
      bitmaps.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The poster itself lives in index.html. In the static mode it gets the light CSS parallax.
  useEffect(() => {
    document.getElementById('poster-img')?.classList.toggle('parallax', staticMode);
  }, [staticMode]);

  const idleSrc = portrait ? `${BASE}/idle-600x800.mp4` : `${BASE}/idle-1280.mp4`;
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" data-testid="journey" data-mode={staticMode ? 'static' : 'full'}>
        <div className="absolute" style={{ inset: 'auto 0 0 0', top: '300px' }}>
          {!staticMode && (
            <>
              <video key={idleSrc} ref={video} src={idleSrc} muted playsInline autoPlay preload="auto" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0 }} />
              <canvas ref={canvas} className="absolute inset-0 h-full w-full" style={{ opacity: 0 }} />
            </>
          )}
          <div className="absolute inset-0 bg-linear-to-b from-background via-transparent to-background" />
        </div>
      </div>
      <PauseControl paused={paused} staticMode={staticMode} onToggle={() => { writePause(!paused); setPaused(!paused); }} />
    </>
  );
}

/** Small floating control over the film. Translucent blur is allowed here and in the nav only. */
function PauseControl({ paused, staticMode, onToggle }: { paused: boolean; staticMode: boolean; onToggle: () => void }) {
  if (staticMode && !paused) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={paused}
      className="fixed bottom-4 right-4 z-40 min-h-11 rounded-full border border-line bg-white/80 px-4 text-sm text-ink backdrop-blur-md"
    >
      {paused ? 'Play motion' : 'Pause motion'}
    </button>
  );
}
