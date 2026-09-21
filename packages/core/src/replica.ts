import type { Op } from '@hillpath/contracts';
import { Hlc } from './hlc';

export type Fields = Record<string, unknown>;
interface Cell {
  v: unknown;
  t: string;
}
interface Row {
  cells: Record<string, Cell>;
  deleted: string | null;
}

/** Rows visible to the app: fields collapsed to plain values, deleted rows hidden. */
export type EntityRow = { id: string } & Fields;

export interface Persistence {
  load(): Promise<Op[]>;
  append(ops: Op[]): Promise<void>;
}

/**
 * State is the fold of an op log. Merge rule: last writer wins per field by HLC,
 * inserts never conflict, deletes are tombstones. Applying the same ops in any
 * order, any number of times, gives the same state.
 */
export class Replica {
  private rows = new Map<string, Map<string, Row>>();
  private seen = new Set<string>();
  private log: Op[] = [];
  private listeners = new Set<() => void>();
  readonly clock: Hlc;

  constructor(
    readonly device: string,
    private readonly store?: Persistence,
    now?: () => number,
  ) {
    this.clock = new Hlc(device, now);
  }

  async open(): Promise<void> {
    if (!this.store) return;
    const ops = await this.store.load();
    this.apply(ops, false);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  /** Create local ops for a mutation and persist them. */
  mutate(entity: string, id: string, kind: Op['kind'], fields?: Fields): Op {
    const hlc = this.clock.tick();
    const op: Op = { op_id: hlc, hlc, device: this.device, entity, id, kind, ...(fields ? { fields: fields as Op['fields'] } : {}) };
    this.apply([op], true);
    return op;
  }

  insert(entity: string, id: string, fields: Fields): Op {
    return this.mutate(entity, id, 'insert', fields);
  }
  set(entity: string, id: string, fields: Fields): Op {
    return this.mutate(entity, id, 'set', fields);
  }
  remove(entity: string, id: string): Op {
    return this.mutate(entity, id, 'tombstone');
  }

  /** Apply ops from anywhere. Returns the ops that were new. */
  apply(ops: Op[], persist = true): Op[] {
    const fresh: Op[] = [];
    for (const op of ops) {
      if (this.seen.has(op.op_id)) continue;
      this.seen.add(op.op_id);
      try {
        this.clock.receive(op.hlc);
      } catch {
        // A remote clock far in the future is still applied; the local clock is left alone.
      }
      const table = this.rows.get(op.entity) ?? new Map<string, Row>();
      this.rows.set(op.entity, table);
      const row = table.get(op.id) ?? { cells: {}, deleted: null };
      table.set(op.id, row);
      if (op.kind === 'tombstone') {
        if (!row.deleted || op.hlc > row.deleted) row.deleted = op.hlc;
      } else {
        for (const [k, v] of Object.entries(op.fields ?? {})) {
          const cell = row.cells[k];
          if (!cell || op.hlc > cell.t) row.cells[k] = { v, t: op.hlc };
        }
      }
      this.log.push(op);
      fresh.push(op);
    }
    if (fresh.length) {
      if (persist && this.store) void this.store.append(fresh);
      this.emit();
    }
    return fresh;
  }

  list(entity: string): EntityRow[] {
    const out: EntityRow[] = [];
    for (const [id, row] of this.rows.get(entity) ?? []) {
      if (row.deleted && Object.values(row.cells).every((c) => c.t < row.deleted!)) continue;
      const o: EntityRow = { id };
      for (const [k, c] of Object.entries(row.cells)) o[k] = c.v;
      out.push(o);
    }
    return out;
  }

  get(entity: string, id: string): EntityRow | undefined {
    return this.list(entity).find((r) => r.id === id);
  }

  allOps(): Op[] {
    return [...this.log];
  }

  /** Highest hlc seen per device. */
  vector(): Record<string, string> {
    const v: Record<string, string> = {};
    for (const op of this.log) if (!v[op.device] || op.hlc > v[op.device]!) v[op.device] = op.hlc;
    return v;
  }

  /** Ops the holder of `remote` has not seen. */
  missingFor(remote: Record<string, string>): Op[] {
    return this.log.filter((op) => !remote[op.device] || op.hlc > remote[op.device]!);
  }

  /** Canonical snapshot for equality checks in tests. */
  snapshot(): string {
    const out: Record<string, unknown> = {};
    for (const [entity, table] of [...this.rows.entries()].sort()) {
      out[entity] = [...table.entries()].sort().map(([id, r]) => [id, r.deleted, Object.entries(r.cells).sort()]);
    }
    return JSON.stringify(out);
  }
}
