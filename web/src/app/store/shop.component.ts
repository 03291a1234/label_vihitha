import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StoreApi } from './store.api';
import { CartService } from './cart.service';
import { StoreProduct } from './store.models';
import { CheckoutResult } from './store.models';
import { resolveImageUrl } from '../core/services/api.services';
import { Notify } from '../core/services/notify.service';

type View = 'shop' | 'checkout' | 'done';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [
    CurrencyPipe, FormsModule, RouterLink, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonToggleModule, MatProgressBarModule
  ],
  template: `
    <div class="store">
      <header class="topbar">
        <div class="brand" (click)="goHome()" title="Home">
          <span class="emblem"><img src="logo.jpeg" alt="Vihitha" /></span>
          <div>
            <div class="name">Vihitha</div>
            <div class="tag">Every thread · every style · every story</div>
          </div>
        </div>
        <div class="top-actions">
          @if (view() === 'shop') {
            <button mat-button routerLink="/login"><mat-icon>lock</mat-icon> Staff</button>
            <button mat-raised-button color="primary" (click)="openCart()">
              <mat-icon>shopping_bag</mat-icon> Cart ({{ cart.count() }}) · {{ cart.total() | currency }}
            </button>
          }
        </div>
      </header>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <!-- SHOP -->
      @if (view() === 'shop') {
        <div class="shop-body" [class.landing]="collection() === null && !search().trim()">
          <div class="products">
            <div class="search-row">
              <mat-form-field class="search">
                <mat-label>Search sarees</mat-label>
                <input matInput [ngModel]="search()" (ngModelChange)="onSearchChange($event)" placeholder="Name or SKU" />
              </mat-form-field>
              @if (search()) { <button mat-button (click)="onSearchChange('')"><mat-icon>close</mat-icon></button> }
            </div>

            @if (collection() === null && !search().trim()) {
              <div class="collections">
                @for (c of collections(); track c.name) {
                  <button class="ctile" (click)="openCollection(c.name)"
                    [style.background-color]="c.color"
                    [style.background-image]="c.image ? 'url(' + img(c.image) + ')' : null">
                    <span class="cveil"></span>
                    <span class="cmeta">
                      <span class="cname">{{ c.name }}</span>
                      <span class="ccount">{{ c.count }} style{{ c.count === 1 ? '' : 's' }}</span>
                    </span>
                  </button>
                }
              </div>
              @if (!loading() && collections().length === 0) { <div class="empty">No collections yet.</div> }
            } @else {
              <div class="crumb">
                <button mat-button (click)="backToCollections()"><mat-icon>arrow_back</mat-icon> Collections</button>
                <span class="crumb-here">{{ collection() || ('Search: “' + search() + '”') }}</span>
              </div>
              <div class="grid">
              @for (p of products(); track p.id) {
                <div class="pcard" [class.out]="!p.inStock">
                  <div class="pimg">
                    @if (img(p.imageUrl); as src) { <img [src]="src" alt="" /> }
                    @else { <mat-icon>checkroom</mat-icon> }
                    @if (!p.inStock) {
                      <div class="soldout-overlay"><span class="soldout-stamp">Sold out</span></div>
                    }
                  </div>
                  <div class="pbody">
                    <div class="pname">{{ p.name }}</div>
                    <div class="pmeta">{{ p.categoryName }}@if (p.subCategoryName) { · {{ p.subCategoryName }} }</div>
                    @if (hasSizes(p)) {
                      <mat-form-field class="size-sel" subscriptSizing="dynamic">
                        <mat-label>Size</mat-label>
                        <mat-select [(ngModel)]="picked[p.id]">
                          @for (v of p.variants; track v.id) {
                            <mat-option [value]="v.id" [disabled]="!v.inStock">{{ v.size }} ({{ v.available }})</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    }
                    <div class="prow">
                      <span class="price">{{ p.price | currency }}</span>
                      <button mat-raised-button color="primary" (click)="add(p)" [disabled]="!p.inStock">Add</button>
                    </div>
                  </div>
                </div>
              }
            </div>
              @if (!loading() && products().length === 0) { <div class="empty">No products found.</div> }
            }
          </div>

          <div class="cart-backdrop" [class.show]="cartOpen()" (click)="closeCart()"></div>
          <aside class="cart" [class.open]="cartOpen()">
            <div class="cart-head">
              <h3>Your cart</h3>
              <button mat-icon-button class="cart-close" (click)="closeCart()" aria-label="Close cart"><mat-icon>close</mat-icon></button>
            </div>
            @if (cart.lines().length === 0) {
              <p class="muted">Your cart is empty. Add a few sarees to get started.</p>
            } @else {
              @for (l of cart.lines(); track l.variant.id) {
                <div class="cline">
                  <div class="cinfo">
                    <div class="cname">{{ l.product.name }}@if (l.variant.size !== 'One Size') { <span class="muted">· {{ l.variant.size }}</span> }</div>
                    <div class="muted">{{ l.product.price | currency }} each</div>
                  </div>
                  <div class="cqty">
                    <button mat-icon-button (click)="dec(l.variant.id, l.quantity)"><mat-icon>remove</mat-icon></button>
                    <span class="q">{{ l.quantity }}</span>
                    <button mat-icon-button (click)="inc(l.variant.id, l.quantity, l.variant.available)"><mat-icon>add</mat-icon></button>
                    <button mat-icon-button color="warn" (click)="cart.remove(l.variant.id)"><mat-icon>close</mat-icon></button>
                  </div>
                </div>
              }
              <div class="ctotal"><span>Total</span><strong>{{ cart.total() | currency }}</strong></div>
              <button mat-raised-button color="primary" class="full" (click)="goCheckout()">Checkout</button>
            }
          </aside>
        </div>
      }

      <!-- CHECKOUT -->
      @if (view() === 'checkout') {
        <div class="checkout">
          <button mat-button (click)="view.set('shop')"><mat-icon>arrow_back</mat-icon> Back to shop</button>
          <div class="cols">
            <div class="card form-card">
              <h3>Your details</h3>
              <mat-form-field class="full"><mat-label>Full name</mat-label><input matInput [(ngModel)]="name" /></mat-form-field>
              <div class="form-row">
                <mat-form-field><mat-label>Phone</mat-label><input matInput [(ngModel)]="phone" /></mat-form-field>
                <mat-form-field><mat-label>Email (optional)</mat-label><input matInput [(ngModel)]="email" /></mat-form-field>
              </div>
              <mat-form-field class="full">
                <mat-label>Payment method</mat-label>
                <mat-select [(ngModel)]="method">
                  <mat-option value="Zelle">Zelle</mat-option>
                  <mat-option value="Cash">Cash</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field class="full"><mat-label>Notes (optional)</mat-label><textarea matInput rows="2" [(ngModel)]="notes"></textarea></mat-form-field>
              <p class="muted small">You'll receive an invoice to pay by {{ method }}. No card is charged online.</p>
            </div>
            <div class="card summary-card">
              <h3>Order summary</h3>
              @for (l of cart.lines(); track l.variant.id) {
                <div class="sline"><span>{{ l.quantity }} × {{ l.product.name }}@if (l.variant.size !== 'One Size') { ({{ l.variant.size }}) }</span><span class="mono">{{ l.product.price * l.quantity | currency }}</span></div>
              }

              <div class="promo">
                <mat-form-field class="promo-field" subscriptSizing="dynamic">
                  <mat-label>Promo code</mat-label>
                  <input matInput [(ngModel)]="promoCode" (keyup.enter)="applyPromo()"
                         (ngModelChange)="onPromoChange()" placeholder="e.g. FESTIVE10" />
                </mat-form-field>
                <button mat-stroked-button (click)="applyPromo()" [disabled]="!promoCode.trim() || promoChecking()">
                  {{ appliedDiscount() > 0 ? 'Update' : 'Apply' }}
                </button>
              </div>
              @if (promoMsg()) { <div class="promo-msg" [class.ok]="appliedDiscount() > 0" [class.err]="appliedDiscount() === 0">{{ promoMsg() }}</div> }

              <div class="manual">
                <mat-form-field class="md-field" subscriptSizing="dynamic">
                  <mat-label>Manual discount</mat-label>
                  <input matInput type="number" min="0" [(ngModel)]="manualValue" />
                  <span matTextPrefix>{{ manualType === 'amount' ? '$ ' : '' }}</span>
                  <span matTextSuffix>{{ manualType === 'percent' ? '%' : '' }}</span>
                </mat-form-field>
                <mat-button-toggle-group [(ngModel)]="manualType" aria-label="Discount type">
                  <mat-button-toggle value="amount">$</mat-button-toggle>
                  <mat-button-toggle value="percent">%</mat-button-toggle>
                </mat-button-toggle-group>
              </div>

              <div class="sline sub"><span>Subtotal</span><span class="mono">{{ cart.total() | currency }}</span></div>
              @if (appliedDiscount() > 0) {
                <div class="sline disc"><span>Promo <span class="muted">({{ appliedCode() }})</span></span><span class="mono">−{{ appliedDiscount() | currency }}</span></div>
              }
              @if (manualDiscountAmount() > 0) {
                <div class="sline disc"><span>Manual discount</span><span class="mono">−{{ manualDiscountAmount() | currency }}</span></div>
              }
              <div class="ctotal"><span>Total</span><strong>{{ finalTotal() | currency }}</strong></div>
              <button mat-raised-button color="primary" class="full" (click)="placeOrder()" [disabled]="!name.trim() || placing()">
                {{ placing() ? 'Placing…' : 'Place order' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- DONE -->
      @if (view() === 'done' && result(); as r) {
        <div class="done">
          <div class="card done-card">
            <mat-icon class="ok">check_circle</mat-icon>
            <h2>Thank you, {{ r.customerName }}!</h2>
            <p>Your order <strong>{{ r.orderNumber }}</strong> is confirmed.</p>
            @if (r.discount > 0) { <p class="saved">You saved {{ r.discount | currency }}!</p> }
            <p>Invoice <strong>{{ r.invoiceNumber }}</strong> for <strong>{{ r.grandTotal | currency }}</strong> — pay by {{ r.paymentMethod }}.</p>
            <button mat-raised-button color="primary" (click)="continueShopping()">Continue shopping</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .store { min-height: 100vh; background: var(--lv-cream); overflow-x: hidden; }
    .topbar {
      position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between;
      gap: 16px; padding: 12px 24px; background: linear-gradient(160deg, #6e1f3e, #3f1228); color: #fff;
      flex-wrap: wrap;
    }
    .brand { display: flex; align-items: center; gap: 12px; cursor: pointer; min-width: 0; }
    .brand > div { min-width: 0; }
    /* Never let the tagline wrap word-by-word — truncate instead. */
    .brand .tag { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60vw; }
    .emblem { width: 46px; height: 46px; border-radius: 50%; overflow: hidden; display: grid; place-items: center;
      background: #fbf5ea; border: 2px solid #c39a3e; flex: 0 0 auto; }
    .emblem img { width: 122%; height: 122%; object-fit: cover; }
    .brand .name { font-family: "Cormorant Garamond", Georgia, serif; font-size: 24px; font-weight: 700; line-height: 1; }
    .brand .tag { font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; color: #d9b24c; margin-top: 3px; }
    .top-actions { display: flex; align-items: center; gap: 8px; }
    .top-actions .mat-mdc-button { color: #f3e4ec; }

    .shop-body { display: grid; grid-template-columns: 1fr 320px; gap: 24px; padding: 24px; max-width: 1200px; margin: 0 auto; align-items: start; }
    /* Collections landing spans the full width — no cart sidebar to shop yet. */
    .shop-body.landing { grid-template-columns: 1fr; }
    @media (min-width: 821px) { .shop-body.landing .cart, .shop-body.landing .cart-backdrop { display: none; } }
    .products { min-width: 0; }
    .search-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .search { flex: 1 1 auto; min-width: 0; max-width: 340px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 18px; }

    /* Collections landing */
    .collections { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
    .ctile { position: relative; border: none; cursor: pointer; height: 210px; border-radius: 16px; overflow: hidden;
      padding: 0; text-align: left; background-size: cover; background-position: center; background-color: var(--lv-wine);
      box-shadow: 0 6px 20px rgba(110,31,62,.10); transition: transform .15s, box-shadow .15s; }
    .ctile:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(110,31,62,.20); }
    .ctile .cveil { position: absolute; inset: 0; background: linear-gradient(to top, rgba(40,12,26,.66), rgba(40,12,26,.12) 55%, rgba(40,12,26,.04)); }
    .ctile .cmeta { position: absolute; left: 16px; right: 16px; bottom: 14px; z-index: 1; display: flex; flex-direction: column; gap: 3px; }
    .ctile .cname { font-family: "Cormorant Garamond", Georgia, serif; font-size: 25px; font-weight: 700; color: #fff; line-height: 1.05; }
    .ctile .ccount { font-size: 11px; color: rgba(255,255,255,.85); text-transform: uppercase; letter-spacing: 1.2px; }
    .crumb { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .crumb-here { font-family: "Cormorant Garamond", Georgia, serif; font-size: 24px; font-weight: 700; color: var(--lv-wine); }
    .pcard { background: #fff; border: 1px solid var(--lv-line); border-radius: 14px; overflow: hidden; box-shadow: 0 6px 20px rgba(110,31,62,.06); display: flex; flex-direction: column; }
    .pcard.out { opacity: .7; }
    .pimg { position: relative; height: 180px; background: #f3ead9; display: grid; place-items: center; }
    .pimg img { width: 100%; height: 100%; object-fit: cover; }
    .pimg mat-icon { font-size: 46px; height: 46px; width: 46px; color: #c9a24b; }
    .soldout-overlay { position: absolute; inset: 0; display: grid; place-items: center;
      background: rgba(58,37,48,.45); backdrop-filter: saturate(.6); }
    .soldout-stamp { transform: rotate(-12deg); border: 3px solid #fff; color: #fff; font-weight: 800;
      text-transform: uppercase; letter-spacing: 2px; font-size: 18px; padding: 6px 16px; border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,.25); }
    .pbody { padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
    .pname { font-weight: 600; line-height: 1.2; }
    .pmeta { font-size: 12px; color: rgba(58,37,48,.55); }
    .size-sel { width: 100%; margin: 6px 0 2px; }
    .prow { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .price { font-family: "Cormorant Garamond", Georgia, serif; font-size: 22px; font-weight: 700; color: var(--lv-wine); }

    .cart { position: sticky; top: 88px; background: #fff; border: 1px solid var(--lv-line); border-radius: 14px; padding: 16px; box-shadow: 0 6px 20px rgba(110,31,62,.06); }
    .cart-head { display: flex; align-items: center; justify-content: space-between; }
    .cart h3 { margin: 0 0 10px; font-family: "Cormorant Garamond", Georgia, serif; color: var(--lv-wine); }
    .cart-close { display: none; }
    .cart-backdrop { display: none; }
    .cline { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid #f0e6ea; }
    .cname { font-size: 14px; font-weight: 500; }
    .cqty { display: flex; align-items: center; gap: 2px; }
    .cqty .q { min-width: 20px; text-align: center; }
    .ctotal { display: flex; justify-content: space-between; align-items: baseline; margin: 14px 0; font-size: 18px; }
    .ctotal strong { font-size: 22px; color: var(--lv-wine); }
    .full { width: 100%; }
    .muted { color: rgba(58,37,48,.55); } .small { font-size: 12px; } .mono { font-variant-numeric: tabular-nums; }
    .empty { padding: 40px; text-align: center; color: rgba(58,37,48,.5); }

    .checkout, .done { max-width: 900px; margin: 0 auto; padding: 24px; }
    .cols { display: grid; grid-template-columns: 1fr 340px; gap: 20px; margin-top: 12px; }
    .card { background: #fff; border: 1px solid var(--lv-line); border-radius: 14px; padding: 20px; box-shadow: 0 6px 20px rgba(110,31,62,.06); }
    .card h3 { margin: 0 0 14px; font-family: "Cormorant Garamond", Georgia, serif; color: var(--lv-wine); }
    .form-row { display: flex; gap: 12px; } .form-row > * { flex: 1; }
    .sline { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: 14px; }
    .sline.sub { border-top: 1px solid var(--lv-line); margin-top: 6px; padding-top: 10px; }
    .sline.disc { color: #1e7d3a; font-weight: 600; }
    .promo { display: flex; gap: 8px; align-items: flex-start; margin: 12px 0 4px; }
    .promo-field { flex: 1; }
    .promo-msg { font-size: 13px; margin: 2px 0 6px; }
    .promo-msg.ok { color: #1e7d3a; } .promo-msg.err { color: #b3261e; }
    .manual { display: flex; gap: 8px; align-items: center; margin: 10px 0 4px; }
    .manual .md-field { flex: 1; }
    .manual mat-button-toggle-group { height: 40px; }
    .saved { color: #1e7d3a; font-weight: 700; }
    .done { display: grid; place-items: center; min-height: 60vh; }
    .done-card { text-align: center; max-width: 460px; }
    .done-card .ok { font-size: 56px; height: 56px; width: 56px; color: #2e7d32; }
    .done-card h2 { font-family: "Cormorant Garamond", Georgia, serif; color: var(--lv-wine); margin: 8px 0; }

    @media (max-width: 820px) {
      .shop-body { grid-template-columns: 1fr; }
      .cols { grid-template-columns: 1fr; }
      /* Cart becomes a slide-up drawer opened from the header Cart button. */
      .cart {
        position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 60;
        margin: 0; max-height: 82vh; overflow-y: auto; border-radius: 18px 18px 0 0;
        transform: translateY(105%); transition: transform .28s ease; box-shadow: 0 -8px 30px rgba(0,0,0,.28);
      }
      .cart.open { transform: translateY(0); }
      .cart-close { display: inline-flex; }
      .cart-backdrop.show { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.42); z-index: 55; }
    }
    /* Phones (incl. narrow foldables like the Flip): stack cleanly, no horizontal overflow. */
    @media (max-width: 560px) {
      .topbar { padding: 10px 14px; gap: 8px; }
      .brand .name { font-size: 20px; }
      .brand .tag { display: none; }
      .top-actions { gap: 4px; }
      .shop-body { padding: 16px; gap: 16px; }
      .grid { grid-template-columns: 1fr; }
      .checkout, .done { padding: 16px; }
      .form-row { flex-wrap: wrap; }
    }
  `]
})
export class ShopComponent {
  private api = inject(StoreApi);
  private notify = inject(Notify);
  cart = inject(CartService);

  allProducts = signal<StoreProduct[]>([]);
  loading = signal(false);
  view = signal<View>('shop');
  placing = signal(false);
  result = signal<CheckoutResult | null>(null);

  search = signal('');
  /** The chosen collection (category name); null shows the collections landing. */
  collection = signal<string | null>(null);

  /** Tile colours cycled across collections when a category has no representative photo. */
  private palette = ['#6e1f3e', '#0F6E56', '#D85A30', '#993556', '#BA7517', '#3B6D11', '#185FA5', '#7F77DD'];

  /** Collections landing: products grouped by category, with a count and a representative image. */
  collections = computed(() => {
    const map = new Map<string, { name: string; count: number; image: string | null }>();
    for (const p of this.allProducts()) {
      const key = p.categoryName || 'Other';
      let c = map.get(key);
      if (!c) { c = { name: key, count: 0, image: null }; map.set(key, c); }
      c.count++;
      if (!c.image && p.imageUrl) c.image = p.imageUrl;
    }
    return [...map.values()].sort((a, b) => {
      // Keep Accessories last; everything else alphabetical.
      const al = a.name.toLowerCase() === 'accessories' ? 1 : 0;
      const bl = b.name.toLowerCase() === 'accessories' ? 1 : 0;
      return al !== bl ? al - bl : a.name.localeCompare(b.name);
    }).map((c, i) => ({ ...c, color: this.palette[i % this.palette.length] }));
  });

  /** Products shown in the grid: filtered by the open collection and/or the search query. */
  products = computed(() => {
    const q = this.search().trim().toLowerCase();
    const col = this.collection();
    let list = this.allProducts();
    if (col) list = list.filter(p => (p.categoryName || 'Other') === col);
    if (q) list = list.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.categoryName ?? '').toLowerCase().includes(q));
    return list;
  });
  name = '';
  phone = '';
  email = '';
  method: 'Zelle' | 'Cash' = 'Zelle';
  notes = '';

  // Promo code
  promoCode = '';
  promoChecking = signal(false);
  promoMsg = signal('');
  appliedDiscount = signal(0);
  appliedCode = signal<string | null>(null);

  // Manual (ad-hoc) discount
  manualValue: number | null = null;
  manualType: 'amount' | 'percent' = 'amount';

  constructor() { this.load(); }

  img(url: string | null | undefined) { return resolveImageUrl(url); }

  /** Search filters the already-loaded catalogue client-side (no round-trip). */
  onSearchChange(value: string) { this.search.set(value); }

  openCollection(name: string) { this.collection.set(name); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* ignore */ } }
  backToCollections() { this.collection.set(null); this.search.set(''); }

  load() {
    this.loading.set(true);
    this.api.products().subscribe({
      next: (p) => { this.allProducts.set(p); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  /** Chosen variant id per product card (for products with more than one size). */
  picked: Record<number, number> = {};

  /** Show a size picker only when there's a real choice beyond a single "One Size". */
  hasSizes(p: StoreProduct): boolean {
    return p.variants.length > 1 || (p.variants.length === 1 && p.variants[0].size !== 'One Size');
  }

  add(p: StoreProduct) {
    const choices = p.variants ?? [];
    let variant = choices.length === 1 ? choices[0] : choices.find(v => v.id === this.picked[p.id]);
    if (!variant) { this.notify.error(null, 'Please choose a size'); return; }
    if (!variant.inStock) { this.notify.error(null, `Size ${variant.size} is sold out`); return; }
    this.cart.add(p, variant);
    const label = variant.size === 'One Size' ? p.name : `${p.name} (${variant.size})`;
    this.notify.success(`${label} added to cart`);
  }
  inc(id: number, qty: number, available: number) { if (qty < available) this.cart.setQty(id, qty + 1); }
  dec(id: number, qty: number) { if (qty > 1) this.cart.setQty(id, qty - 1); else this.cart.remove(id); }

  goHome() { this.view.set('shop'); this.collection.set(null); this.search.set(''); this.closeCart(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* ignore */ } }
  goCheckout() { if (this.cart.count() > 0) { this.closeCart(); this.view.set('checkout'); } }

  /** Mobile cart drawer (on desktop the sidebar is always visible, so this is a no-op there). */
  cartOpen = signal(false);
  openCart() { this.cartOpen.set(true); }
  closeCart() { this.cartOpen.set(false); }

  private cartItems() {
    return this.cart.lines().map(l => ({ productId: l.product.id, quantity: l.quantity, productVariantId: l.variant.id }));
  }
  /** The manual discount as a $ amount (from a fixed value or a % of subtotal), capped at subtotal. */
  manualDiscountAmount(): number {
    const v = Number(this.manualValue) || 0;
    if (v <= 0) return 0;
    const sub = this.cart.total();
    const amt = this.manualType === 'percent' ? sub * v / 100 : v;
    return Math.min(Math.round(amt * 100) / 100, sub);
  }
  /** Combined promo + manual discount, capped at subtotal. */
  private totalDiscount(): number {
    return Math.min(this.cart.total(), this.appliedDiscount() + this.manualDiscountAmount());
  }
  finalTotal(): number { return this.cart.total() - this.totalDiscount(); }
  /** Editing the code invalidates a previously applied discount until re-applied. */
  onPromoChange() {
    if (this.appliedCode() && this.promoCode.trim().toUpperCase() !== this.appliedCode()) {
      this.appliedDiscount.set(0); this.appliedCode.set(null); this.promoMsg.set('');
    }
  }
  applyPromo() {
    const code = this.promoCode.trim();
    if (!code || this.cart.count() === 0) return;
    this.promoChecking.set(true);
    this.api.validatePromo(code, this.cartItems()).subscribe({
      next: (r) => {
        this.promoChecking.set(false);
        this.promoMsg.set(r.message);
        this.appliedDiscount.set(r.valid ? r.discountAmount : 0);
        this.appliedCode.set(r.valid ? (r.code ?? code.toUpperCase()) : null);
      },
      error: (e) => { this.promoChecking.set(false); this.appliedDiscount.set(0); this.appliedCode.set(null); this.notify.error(e); }
    });
  }

  placeOrder() {
    if (!this.name.trim() || this.cart.count() === 0) return;
    this.placing.set(true);
    this.api.checkout({
      customerName: this.name.trim(),
      customerPhone: this.phone || null,
      customerEmail: this.email || null,
      paymentMethod: this.method,
      notes: this.notes || null,
      items: this.cartItems(),
      promoCode: this.appliedCode(),
      manualDiscount: this.manualDiscountAmount()
    }).subscribe({
      next: (r) => { this.result.set(r); this.cart.clear(); this.view.set('done'); this.placing.set(false); },
      error: (e) => { this.placing.set(false); this.notify.error(e); }
    });
  }

  continueShopping() {
    this.name = this.phone = this.email = this.notes = '';
    this.method = 'Zelle';
    this.promoCode = ''; this.promoMsg.set(''); this.appliedDiscount.set(0); this.appliedCode.set(null);
    this.manualValue = null; this.manualType = 'amount';
    this.result.set(null);
    this.view.set('shop');
    this.load();
  }
}
