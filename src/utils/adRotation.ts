import type { PlacementSequenceMode } from '../types/ad';
import type { PriorityTierRotateOrder } from '../types/job';

export type AnySequenceMode = PlacementSequenceMode | PriorityTierRotateOrder;

const pageLoadCursors = new Map<string, number>();
const pageLoadShuffleSeeds = new Map<string, number>();

function getVisitCursor(key: string): number {
  if (pageLoadCursors.has(key)) {
    return pageLoadCursors.get(key)!;
  }
  let current = 0;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storageKey = `hybrid_rot_cursor_${key}`;
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw !== null ? parseInt(raw, 10) : 0;
      current = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      window.localStorage.setItem(storageKey, String((current + 1) % 100000));
    }
  } catch {
    current = Math.floor(Math.random() * 1000);
  }
  pageLoadCursors.set(key, current);
  return current;
}

function getVisitShuffleSeed(key: string): number {
  if (pageLoadShuffleSeeds.has(key)) {
    return pageLoadShuffleSeeds.get(key)!;
  }
  const seed = Math.floor(Math.random() * 2147483647) || 1;
  pageLoadShuffleSeeds.set(key, seed);
  return seed;
}

function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/**
 * Reorders items fairly for the current browser page load/visit without mutating the input array.
 * - 'fixed' / 'latest': preserves input order
 * - 'sequential_per_visit' / 'sequential': rotates start position by +1 on every page refresh/visit
 * - 'shuffle_per_visit' / 'shuffle': deterministic per-visit Fisher-Yates shuffle
 */
export function getRotatedItems<T>(
  items: readonly T[],
  rotationKey: string,
  sequenceMode: AnySequenceMode = 'sequential_per_visit'
): T[] {
  if (!Array.isArray(items) || items.length <= 1) {
    return Array.isArray(items) ? [...items] : [];
  }
  if (sequenceMode === 'fixed' || sequenceMode === 'latest') {
    return [...items];
  }
  if (sequenceMode === 'shuffle_per_visit' || sequenceMode === 'shuffle') {
    const copy = [...items];
    const rand = seededRandom(getVisitShuffleSeed(rotationKey));
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }
  // 'sequential_per_visit' or 'sequential'
  const offset = getVisitCursor(rotationKey) % items.length;
  if (offset === 0) return [...items];
  return [...items.slice(offset), ...items.slice(0, offset)];
}

/**
 * Returns up to `count` visible items starting at `startIndex`, wrapping around cleanly.
 */
export function getVisibleWindow<T>(items: readonly T[], startIndex: number, count: number): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const safeCount = Math.max(1, Math.min(items.length, Math.floor(count) || 1));
  const safeStart = ((startIndex % items.length) + items.length) % items.length;
  const result: T[] = [];
  for (let i = 0; i < safeCount; i++) {
    result.push(items[(safeStart + i) % items.length]);
  }
  return result;
}

/**
 * Computes how many positions to advance on each rotation tick when showing `visibleCount` slots
 * out of `total` active items.
 */
export function getNextStepSize(total: number, visibleCount: number): number {
  if (total <= 1 || visibleCount <= 1) return 1;
  if (total >= visibleCount * 2 && total % visibleCount === 0) {
    return visibleCount;
  }
  return 1;
}
