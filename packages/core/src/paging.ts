import { sha256 } from '@noble/hashes/sha2.js';
import { toHex, utf8 } from './bytes';

const PREFIX = 'HP1';
export const PAGE_CHARS = 900;

export interface Page {
  id: string;
  idx: number;
  total: number;
  chunk: string;
}

/** Split text into QR-sized pages. Pages can be shown in a loop and scanned in any order. */
export function toPages(text: string, pageChars = PAGE_CHARS): string[] {
  const id = toHex(sha256(utf8(text))).slice(0, 8);
  const total = Math.max(1, Math.ceil(text.length / pageChars));
  return Array.from({ length: total }, (_, idx) => `${PREFIX}|${id}|${idx}|${total}|${text.slice(idx * pageChars, (idx + 1) * pageChars)}`);
}

export function parsePage(raw: string): Page | null {
  const parts = raw.split('|');
  if (parts.length < 5 || parts[0] !== PREFIX) return null;
  const idx = Number(parts[2]);
  const total = Number(parts[3]);
  if (!Number.isInteger(idx) || !Number.isInteger(total) || idx < 0 || idx >= total || total > 500) return null;
  return { id: parts[1]!, idx, total, chunk: parts.slice(4).join('|') };
}

export class PageAssembler {
  private id: string | null = null;
  private total = 0;
  private got = new Map<number, string>();

  /** Returns progress, and the full text once every page has arrived and the hash matches. */
  add(raw: string): { progress: number; text?: string } {
    const p = parsePage(raw);
    if (!p) return { progress: this.progress() };
    if (this.id !== p.id) {
      this.id = p.id;
      this.total = p.total;
      this.got.clear();
    }
    this.got.set(p.idx, p.chunk);
    if (this.got.size === this.total) {
      const text = Array.from({ length: this.total }, (_, i) => this.got.get(i) ?? '').join('');
      if (toHex(sha256(utf8(text))).slice(0, 8) === this.id) return { progress: 1, text };
      this.got.clear();
      this.id = null;
    }
    return { progress: this.progress() };
  }

  progress(): number {
    return this.total === 0 ? 0 : this.got.size / this.total;
  }

  reset(): void {
    this.id = null;
    this.total = 0;
    this.got.clear();
  }
}
