import { PALETTE, type Tile } from '../content/patterns';

/** One weave tile as an SVG. Colour is never the only cue: each tile also has its own shape. */
export function TileSvg({ tile, size = 64 }: { tile: Tile; size?: number }) {
  const c = PALETTE[tile.color]!;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <rect x="2" y="2" width="60" height="60" rx="8" fill="var(--c-surface)" stroke="var(--c-line)" strokeWidth="2" />
      {tile.shape === 'circle' && <circle cx="32" cy="32" r="18" fill={c} />}
      {tile.shape === 'square' && <rect x="16" y="16" width="32" height="32" fill={c} />}
      {tile.shape === 'diamond' && <polygon points="32,10 54,32 32,54 10,32" fill={c} />}
      {tile.shape === 'triangle' && <polygon points="32,12 54,52 10,52" fill={c} />}
      {tile.shape === 'cross' && <path d="M26 10h12v16h16v12H38v16H26V38H10V26h16z" fill={c} />}
      {tile.shape === 'bars' && (
        <>
          <rect x="12" y="14" width="40" height="8" fill={c} />
          <rect x="12" y="28" width="40" height="8" fill={c} />
          <rect x="12" y="42" width="40" height="8" fill={c} />
        </>
      )}
    </svg>
  );
}
