import { Injectable, computed, signal } from '@angular/core';
import { CartLine, StoreProduct, StoreVariant } from './store.models';

const KEY = 'lv_cart';

/** Cart lines are keyed by size variant (a variant id is unique across all products). */
@Injectable({ providedIn: 'root' })
export class CartService {
  private _lines = signal<CartLine[]>(this.read());

  readonly lines = this._lines.asReadonly();
  readonly count = computed(() => this._lines().reduce((n, l) => n + l.quantity, 0));
  readonly total = computed(() => this._lines().reduce((s, l) => s + l.product.price * l.quantity, 0));

  add(product: StoreProduct, variant: StoreVariant, quantity = 1) {
    const lines = [...this._lines()];
    const existing = lines.find(l => l.variant.id === variant.id);
    const inCart = existing?.quantity ?? 0;
    const next = Math.min(inCart + quantity, variant.available);
    if (next <= 0) return;
    if (existing) existing.quantity = next;
    else lines.push({ product, variant, quantity: next });
    this.commit(lines);
  }

  setQty(variantId: number, quantity: number) {
    const lines = this._lines()
      .map(l => l.variant.id === variantId
        ? { ...l, quantity: Math.max(1, Math.min(quantity, l.variant.available)) }
        : l);
    this.commit(lines);
  }

  remove(variantId: number) {
    this.commit(this._lines().filter(l => l.variant.id !== variantId));
  }

  clear() { this.commit([]); }

  private commit(lines: CartLine[]) {
    this._lines.set(lines);
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }

  private read(): CartLine[] {
    try {
      const raw = localStorage.getItem(KEY);
      const lines = raw ? (JSON.parse(raw) as CartLine[]) : [];
      // Drop any legacy lines saved before size variants existed.
      return lines.filter(l => l && l.variant && typeof l.variant.id === 'number');
    } catch { return []; }
  }
}
