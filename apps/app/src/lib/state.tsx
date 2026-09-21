import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { EntityRow } from '@hillpath/core';
import { AppCore } from './core';

const Ctx = createContext<AppCore | null>(null);

export function AppProvider({ children, dbName }: { children: ReactNode; dbName?: string }) {
  const [core, setCore] = useState<AppCore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    AppCore.create(dbName)
      .then((c) => alive && setCore(c))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'unknown'));
    return () => {
      alive = false;
    };
  }, [dbName]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-3xl font-bold">Hillpath could not open its storage</h1>
        <p className="mt-4 text-xl">Your browser may be blocking storage in a private window. Open Hillpath in a normal window and try again.</p>
      </main>
    );
  }
  if (!core) return <p className="p-8 text-xl" role="status">Opening Hillpath</p>;
  return <Ctx.Provider value={core}>{children}</Ctx.Provider>;
}

export function useCore(): AppCore {
  const c = useContext(Ctx);
  if (!c) throw new Error('AppProvider is missing');
  return c;
}

/** Re-renders whenever any op is applied or device state changes. */
export function useVersion(): number {
  const core = useCore();
  return useSyncExternalStore(
    (fn) => core.subscribe(fn),
    () => core.version,
  );
}

export function useEntity(entity: string): EntityRow[] {
  const core = useCore();
  const v = useVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => core.replica.list(entity), [core, entity, v]);
}
