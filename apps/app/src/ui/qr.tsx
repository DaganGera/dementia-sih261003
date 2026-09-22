import { FountainDecoder, FountainEncoder, PageAssembler, toPages } from '@hillpath/core';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BigButton } from './kit';

const PAGE = 600;
const FRAME_MS = 170;
/** Above this many characters the text goes out as an endless fountain of frames instead of a fixed loop of pages. */
const FOUNTAIN_ABOVE = 1200;

/**
 * Shows text as moving QR frames. Short text loops through numbered pages. Long text uses fountain frames, so a
 * scanner that misses some frames simply waits for more instead of waiting for one particular page. Has a pause control.
 */
export function QRShow({ text, label }: { text: string; label: string }) {
  const fountain = text.length > FOUNTAIN_ABOVE;
  const encoder = useMemo(() => (fountain ? new FountainEncoder(text) : null), [fountain, text]);
  const pages = useMemo(() => (fountain ? [] : toPages(text, PAGE)), [fountain, text]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const count = fountain ? encoder!.k : pages.length;

  useEffect(() => {
    if (paused || (!fountain && pages.length < 2)) return;
    const t = window.setInterval(() => setI((x) => x + 1), FRAME_MS);
    return () => window.clearInterval(t);
  }, [paused, fountain, pages.length]);

  const current = fountain ? encoder!.frame(i) : pages[i % pages.length]!;
  useEffect(() => {
    if (canvas.current) void QRCode.toCanvas(canvas.current, current, { errorCorrectionLevel: 'L', margin: 2, width: 320 });
  }, [current]);

  // For pasting in place of a camera: enough frames to rebuild the text.
  const pasteText = useMemo(() => (fountain ? Array.from({ length: Math.ceil(encoder!.k * 1.7) + 6 }, (_, s) => encoder!.frame(s)).join('\n') : pages.join('\n')), [fountain, encoder, pages]);

  return (
    <figure className="flex flex-col items-center gap-3" data-testid="qr-show" data-mode={fountain ? 'fountain' : 'pages'}>
      <canvas ref={canvas} role="img" aria-label={label} className="rounded-input border-2 border-line bg-white" width={320} height={320} />
      <figcaption className="text-base" aria-live="off">
        {fountain ? `The code keeps changing. About ${Math.ceil(count * 1.5)} frames are needed.` : `Frame ${(i % count) + 1} of ${count}.`} Hold the other phone steady in front of this screen.
      </figcaption>
      {(fountain || pages.length > 1) && (
        <BigButton className="btn-quiet" onClick={() => setPaused(!paused)}>
          {paused ? 'Keep moving' : 'Pause the code'}
        </BigButton>
      )}
      <textarea readOnly className="field sr-only" aria-label="Code text for pasting" value={pasteText} data-testid="qr-text" />
    </figure>
  );
}

/** Camera scanner with a paste fallback. Reads page frames and fountain frames. */
export function QRScan({ onText, prompt = 'Point the camera at the moving code.' }: { onText: (text: string) => void; prompt?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const asm = useRef(new PageAssembler());
  const fdec = useRef(new FountainDecoder());
  const [progress, setProgress] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const finished = useRef(false);

  const feed = (raw: string) => {
    if (finished.current) return;
    const r = raw.startsWith('HF1|') ? fdec.current.add(raw) : asm.current.add(raw);
    setProgress(r.progress);
    if (r.text) {
      finished.current = true;
      onText(r.text);
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    const c = document.createElement('canvas');
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = video.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        timer = window.setInterval(() => {
          if (!v.videoWidth) return;
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (code) feed(code.data);
        }, 100);
      } catch {
        setCameraError('Hillpath needs the camera to scan codes. Allow it in Settings, or paste the code text below.');
      }
    })();
    return () => {
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3" data-testid="qr-scan">
      <p>{prompt}</p>
      {!cameraError && <video ref={video} muted playsInline className="w-full max-w-md rounded-input border-2 border-line" aria-label="Camera view" />}
      {cameraError && <p role="alert" className="card">{cameraError}</p>}
      <progress value={progress} max={1} aria-label="Scan progress" className="w-full" />
      <details>
        <summary className="cursor-pointer py-2">Paste the code text instead</summary>
        <textarea className="field" rows={3} aria-label="Paste code text" value={paste} onChange={(e) => setPaste(e.target.value)} data-testid="qr-paste" />
        <BigButton
          className="mt-2"
          onClick={() => {
            for (const line of paste.split('\n')) if (line.trim()) feed(line.trim());
            setPaste('');
          }}
        >
          Use this text
        </BigButton>
      </details>
    </div>
  );
}
