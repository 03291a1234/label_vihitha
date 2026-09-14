import { Sort } from '@angular/material/sort';

/**
 * Client-side sort for in-memory rows (used by the non-paginated lists).
 * Sorts by the property named by `sort.active`; numbers numerically, everything
 * else by locale-aware string compare. Nulls sort last.
 */
export function sortRows<T>(rows: readonly T[], sort: Sort): T[] {
  const data = [...rows];
  if (!sort.active || sort.direction === '') return data;
  const dir = sort.direction === 'desc' ? -1 : 1;

  return data.sort((a, b) => {
    const av = (a as Record<string, unknown>)[sort.active];
    const bv = (b as Record<string, unknown>)[sort.active];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}
