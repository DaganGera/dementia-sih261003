import type { HorizonForecast } from '@hillpath/ml';

const DOMAIN_NAMES: Record<string, string> = {
  visual_memory: 'Remembering pictures',
  associative_memory: 'Faces and names',
  verbal_memory: 'Remembering stories',
  procedural: 'Everyday routines',
  attention: 'Attention',
};
export const domainName = (d: string) => DOMAIN_NAMES[d] ?? d;

interface Band {
  domain: string;
  mean: number;
  low: number;
  high: number;
}

/** Ability per area with a 90% interval. Every chart has a table view, and colour is never the only cue. */
export function AbilityBands({ rows, unit = 'ability units' }: { rows: Band[]; unit?: string }) {
  const lo = -3;
  const hi = 3;
  const x = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100;
  return (
    <div>
      <svg role="img" aria-label="Ability in each area with a 90 percent range" viewBox="0 0 100 60" className="w-full" preserveAspectRatio="none" style={{ height: 240 }}>
        {rows.map((r, i) => (
          <g key={r.domain} transform={`translate(0, ${i * 12 + 4})`}>
            <line x1={x(r.low)} x2={x(r.high)} y1={4} y2={4} stroke="var(--c-ink)" strokeWidth={0.8} />
            <line x1={x(r.low)} x2={x(r.low)} y1={2} y2={6} stroke="var(--c-ink)" strokeWidth={0.6} />
            <line x1={x(r.high)} x2={x(r.high)} y1={2} y2={6} stroke="var(--c-ink)" strokeWidth={0.6} />
            <circle cx={x(r.mean)} cy={4} r={1.6} fill="var(--c-accent)" stroke="var(--c-ink)" strokeWidth={0.4} />
          </g>
        ))}
        <line x1={x(0)} x2={x(0)} y1={0} y2={60} stroke="var(--c-line)" strokeWidth={0.4} strokeDasharray="1 1" />
      </svg>
      <details>
        <summary className="cursor-pointer py-2">View as a table</summary>
        <table className="w-full text-left">
          <thead>
            <tr><th scope="col">Area</th><th scope="col">Estimate</th><th scope="col">90% range</th></tr>
          </thead>
          <tbody className="tnum">
            {rows.map((r) => (
              <tr key={r.domain}>
                <th scope="row" className="font-normal">{domainName(r.domain)}</th>
                <td>{r.mean.toFixed(2)}</td>
                <td>{r.low.toFixed(2)} to {r.high.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-muted">Scale: {unit}. 0 is the typical starting point.</p>
      </details>
    </div>
  );
}

export function ForecastTable({ rows }: { rows: HorizonForecast[] }) {
  return (
    <table className="w-full text-left">
      <thead>
        <tr><th scope="col">Months ahead</th><th scope="col">Expected</th><th scope="col">80% range</th></tr>
      </thead>
      <tbody className="tnum">
        {rows.map((r) => (
          <tr key={r.months}>
            <th scope="row" className="font-normal">{r.months}</th>
            <td>{r.mean.toFixed(2)}</td>
            <td>{r.low80.toFixed(2)} to {r.high80.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface Point {
  x: number;
  y: number;
  low?: number;
  high?: number;
}

/** A simple line with an optional band. The table alternative is rendered by the caller. */
export function Line({ points, label, width = 320, height = 140 }: { points: Point[]; label: string; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.flatMap((p) => [p.y, p.low ?? p.y, p.high ?? p.y]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => ((x - x0) / (x1 - x0 || 1)) * (width - 16) + 8;
  const sy = (y: number) => height - 8 - ((y - y0) / (y1 - y0 || 1)) * (height - 16);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const band = points.every((p) => p.low !== undefined && p.high !== undefined)
    ? `${points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.high!).toFixed(1)}`).join(' ')} ${[...points].reverse().map((p) => `L${sx(p.x).toFixed(1)},${sy(p.low!).toFixed(1)}`).join(' ')} Z`
    : null;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {band && <path d={band} fill="var(--c-line)" opacity={0.6} />}
      <path d={line} fill="none" stroke="var(--c-accent)" strokeWidth={2} />
    </svg>
  );
}
