import { useEffect, useState } from 'react';

/** Hash router: `#/patient/games/G1` gives ["patient", "games", "G1"]. */
export function parseHash(hash: string): string[] {
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on, { passive: true });
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(...parts: string[]): void {
  window.location.hash = `#/${parts.join('/')}`;
}
