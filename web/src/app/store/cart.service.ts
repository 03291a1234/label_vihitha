import { Injectable, computed, signal } from '@angular/core';
import { CartLine, StoreProduct } from './store.models';

const KEY = 'lv_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private _lines = signal<CartLine[]>(this.read());

  readonly lines = this._lines.asReadonly();
  readonly count = computed(() => this._lines().reduce((n, l) => n + l.quantity, 0));
  readonly total = computed(() => this._lines().reduce((s, l) => s + l.product.price * l.quantity, 0));

  add(product: StoreProduct, quantity = 1) {
    const lines = [...this._lines()];
    const existing = lines.find(l => l.product.id === product.id);
    const inCart = existing?.quantity ?? 0;
    // Never exceed available stock.
    const next = Math.min(inCart + quantity, product.available);
    if (next <= 0) return;
    if (existing) existing.quantity = next;
    else lines.push({ product, quantity: next });
    this.commit(lines);
  }

  setQty(productId: number, quantity: number) {
    const lines = this._lines()
      .map(l => l.product.id === productId
        ? { ...l, quantity: Math.max(1, Math.min(quantity, l.product.available)) }
        : l);
    this.commit(lines);
  }

  remove(productId: number) {
    this.commit(this._lines().filter(l => l.product.id !== productId));
  }

  clear() { this.commit([]); }

  private commit(lines: CartLine[]) {
    this._lines.set(lines);
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }

  private read(): CartLine[] {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch { return []; }
  }
}
