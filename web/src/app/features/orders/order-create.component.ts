import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { CustomerApi, OrderApi, ProductApi, PromoCodeApi, CreateOrderItem, OrderChargeInput } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Customer, Product, ProductVariant } from '../../core/models';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { MoneyInputComponent } from '../../shared/money-input.component';

interface Line { product: Product; variant: ProductVariant; quantity: number; finalPrice: number; }
type SortCol = 'product' | 'size' | 'quantity' | 'salePrice' | 'finalPrice' | 'lineTotal';

@Component({
  selector: 'app-order-create',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CurrencyPipe, FormsModule, RouterLink, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatDatepickerModule,
    SearchSelectComponent, MoneyInputComponent
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1><button mat-icon-button routerLink="/orders"><mat-icon>arrow_back</mat-icon></button> New order</h1>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="toolbar-row">
          <div style="flex:1;min-width:280px;">
            <app-search-select label="Customer" [items]="customers()" [(ngModel)]="customerId"
              searchPlaceholder="Search customers…" />
            <button mat-button color="primary" class="newcust-btn" (click)="toggleNewCustomer()">
              <mat-icon>{{ showNewCustomer() ? 'close' : 'person_add' }}</mat-icon>
              {{ showNewCustomer() ? 'Cancel new customer' : 'New customer' }}
            </button>
          </div>
          <mat-form-field style="width:210px;">
            <mat-label>Order date</mat-label>
            <input matInput [matDatepicker]="dp" [max]="todayDate" [(ngModel)]="orderDateObj" />
            <mat-datepicker-toggle matIconSuffix [for]="dp" />
            <mat-datepicker #dp />
            <mat-hint>Backdate to log a past sale</mat-hint>
          </mat-form-field>
        </div>

        @if (showNewCustomer()) {
          <div class="new-customer">
            <h3>New customer</h3>
            <div class="toolbar-row">
              <mat-form-field style="flex:1;min-width:200px;">
                <mat-label>Name</mat-label>
                <input matInput [(ngModel)]="nc.name" placeholder="Full name" />
              </mat-form-field>
              <mat-form-field style="width:180px;">
                <mat-label>Phone</mat-label>
                <input matInput [(ngModel)]="nc.phone" />
              </mat-form-field>
              <mat-form-field style="width:220px;">
                <mat-label>Email</mat-label>
                <input matInput [(ngModel)]="nc.email" />
              </mat-form-field>
              <button mat-raised-button color="primary" (click)="saveNewCustomer()" [disabled]="savingCustomer()">
                <mat-icon>check</mat-icon> Save &amp; select
              </button>
            </div>
          </div>
        }

        <mat-form-field style="width:100%;">
          <mat-label>Order notes</mat-label>
          <textarea matInput rows="2" [(ngModel)]="notes" placeholder="Alteration requests, special instructions…"></textarea>
        </mat-form-field>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3>Add line item</h3>
        <div class="toolbar-row">
          <div style="min-width:300px;flex:1;">
            <app-search-select label="Product" [items]="productOptions()" labelField="label"
              [(ngModel)]="pickProductId" (selectionChange)="pickVariantId = null" searchPlaceholder="Search by SKU or name…" />
          </div>
          <div style="min-width:170px;">
            <app-search-select label="Size" [items]="sizeOptions()" labelField="label"
              [(ngModel)]="pickVariantId" [disabled]="!pickProductId" searchPlaceholder="Size…" />
          </div>
          <mat-form-field style="width:110px;">
            <mat-label>Qty</mat-label>
            <input matInput type="number" min="1" [(ngModel)]="pickQty" />
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="addLine()"><mat-icon>add</mat-icon> Add</button>
        </div>
      </div>

      <div class="card">
        <table mat-table [dataSource]="lines()" class="full">
          <ng-container matColumnDef="product">
            <th mat-header-cell *matHeaderCellDef (click)="sortBy('product')" class="sortable">Product {{ arrow('product') }}</th>
            <td mat-cell *matCellDef="let l">
              <strong>{{ l.product.sku }}</strong> {{ l.product.name }}
              <span class="chip">{{ l.variant.size }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="quantity">
            <th mat-header-cell *matHeaderCellDef (click)="sortBy('quantity')" class="text-right sortable">Qty {{ arrow('quantity') }}</th>
            <td mat-cell *matCellDef="let l" class="text-right">
              <input class="inline-num" type="number" min="1" [max]="l.variant.quantityOnHand"
                     [(ngModel)]="l.quantity" (ngModelChange)="touch()" />
            </td>
          </ng-container>
          <ng-container matColumnDef="salePrice">
            <th mat-header-cell *matHeaderCellDef (click)="sortBy('salePrice')" class="text-right sortable">List {{ arrow('salePrice') }}</th>
            <td mat-cell *matCellDef="let l" class="text-right mono">{{ l.product.salePrice | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="finalPrice">
            <th mat-header-cell *matHeaderCellDef (click)="sortBy('finalPrice')" class="text-right sortable">Final / unit {{ arrow('finalPrice') }}</th>
            <td mat-cell *matCellDef="let l" class="text-right">
              <input class="inline-num" type="number" min="0" [(ngModel)]="l.finalPrice" (ngModelChange)="touch()" />
            </td>
          </ng-container>
          <ng-container matColumnDef="lineTotal">
            <th mat-header-cell *matHeaderCellDef (click)="sortBy('lineTotal')" class="text-right sortable">Line total {{ arrow('lineTotal') }}</th>
            <td mat-cell *matCellDef="let l" class="text-right mono">{{ l.finalPrice * l.quantity | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let l" class="text-right">
              <button mat-icon-button color="warn" (click)="removeLine(l)"><mat-icon>close</mat-icon></button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (lines().length === 0) { <div class="empty-state">No line items yet — add a product above.</div> }

        <!-- Additional services -->
        <div class="services">
          <h3>Additional services <span class="muted">(stitching, shipping, alteration…)</span></h3>
          @for (s of services(); track $index) {
            <div class="svc-row">
              <span class="svc-label">{{ s.label }}</span>
              <span class="mono svc-amt">{{ s.amount | currency }}</span>
              <button mat-icon-button color="warn" (click)="removeService($index)"><mat-icon>close</mat-icon></button>
            </div>
          }
          <div class="toolbar-row svc-add">
            <mat-form-field style="flex:1;min-width:200px;">
              <mat-label>Service</mat-label>
              <input matInput [(ngModel)]="svcLabel" placeholder="e.g. Stitching" />
            </mat-form-field>
            <app-money-input [(ngModel)]="svcAmount" label="Amount" style="width:230px;" />
            <button mat-stroked-button (click)="addService()"><mat-icon>add</mat-icon> Add service</button>
          </div>
        </div>

        <!-- Discount / promo -->
        <div class="discount">
          <h3>Discount</h3>
          <div class="toolbar-row">
            <mat-form-field style="width:200px;">
              <mat-label>Promo code</mat-label>
              <input matInput [(ngModel)]="promoInput" (ngModelChange)="promoMsg.set('')"
                     placeholder="e.g. DIWALI10" style="text-transform:uppercase;" />
            </mat-form-field>
            <button mat-stroked-button (click)="applyPromo()" [disabled]="!promoInput || checkingPromo()">Apply</button>
            <app-money-input [(ngModel)]="manualDiscount" label="Manual discount" (ngModelChange)="touch()" style="width:230px;" />
          </div>
          @if (promoMsg()) { <div class="promo-msg" [class.ok]="promoOk()">{{ promoMsg() }}</div> }
        </div>

        <div class="totals">
          <div><span class="muted">Subtotal (list)</span> <span class="mono">{{ subTotal() | currency }}</span></div>
          @if (lineDiscount() > 0) { <div><span class="muted">Line negotiation</span> <span class="mono">−{{ lineDiscount() | currency }}</span></div> }
          @if (orderDiscount() > 0) { <div><span class="muted">Discount{{ appliedPromo() ? ' (' + appliedPromo() + ')' : '' }}</span> <span class="mono">−{{ orderDiscount() | currency }}</span></div> }
          @if (servicesTotal() > 0) { <div><span class="muted">Services</span> <span class="mono">+{{ servicesTotal() | currency }}</span></div> }
          <div class="grand"><span>Grand total</span> <span class="mono">{{ grandTotal() | currency }}</span></div>
        </div>

        <div class="text-right" style="margin-top:16px;">
          <button mat-button routerLink="/orders">Cancel</button>
          <button mat-raised-button color="primary" (click)="submit()"
                  [disabled]="!customerId || lines().length === 0 || saving()">
            Create order
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    h3 { margin: 4px 0 12px; }
    .inline-num { width: 80px; text-align: right; border: 1px solid #ddd; border-radius: 6px; padding: 6px; font: inherit; }
    .sortable { cursor: pointer; user-select: none; white-space: nowrap; }
    .sortable:hover { color: var(--lv-wine); }
    .newcust-btn { margin-top: -8px; }
    .new-customer { border: 1px solid var(--lv-line); border-radius: 10px; padding: 12px 14px; margin: 4px 0 12px; background: #fffdfb; }
    .new-customer h3 { margin: 0 0 8px; color: var(--lv-wine); font-size: 15px; }
    .totals { margin-top: 16px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .totals > div { display: flex; gap: 24px; min-width: 280px; justify-content: space-between; }
    .totals .grand { font-size: 18px; font-weight: 600; border-top: 1px solid #eee; padding-top: 8px; margin-top: 4px; }
    .services, .discount { margin-top: 20px; padding-top: 12px; border-top: 1px solid #eee; }
    .services h3, .discount h3 { margin: 0 0 10px; }
    .svc-row { display: flex; align-items: center; gap: 12px; padding: 4px 0; }
    .svc-label { flex: 1; }
    .svc-amt { min-width: 90px; text-align: right; }
    .svc-add { margin-top: 6px; align-items: center; }
    .promo-msg { margin-top: 4px; font-size: 13px; color: #b3261e; }
    .promo-msg.ok { color: #2e7d32; }
  `]
})
export class OrderCreateComponent {
  private customerApi = inject(CustomerApi);
  private productApi = inject(ProductApi);
  private orderApi = inject(OrderApi);
  private promoApi = inject(PromoCodeApi);
  private notify = inject(Notify);
  private router = inject(Router);

  customers = signal<Customer[]>([]);
  products = signal<Product[]>([]);
  lines = signal<Line[]>([]);
  services = signal<OrderChargeInput[]>([]);
  saving = signal(false);

  todayDate = new Date();
  private today = this.todayDate.toISOString().slice(0, 10);
  customerId: number | null = null;
  orderDateObj: Date = new Date();
  notes = '';
  pickProductId: number | null = null;
  pickVariantId: number | null = null;
  pickQty = 1;
  svcLabel = '';
  svcAmount: number | null = null;
  cols = ['product', 'quantity', 'salePrice', 'finalPrice', 'lineTotal', 'actions'];

  // Inline new-customer
  showNewCustomer = signal(false);
  savingCustomer = signal(false);
  nc = { name: '', phone: '', email: '' };

  // Discount / promo
  promoInput = '';
  appliedPromo = signal<string | null>(null);
  promoDiscount = signal(0);
  manualDiscount: number | null = null;
  promoMsg = signal('');
  promoOk = signal(false);
  checkingPromo = signal(false);

  // Sorting
  private sortCol = signal<SortCol | null>(null);
  private sortAsc = signal(true);

  /** Product dropdown options with a rich, searchable label. */
  productOptions = computed(() => this.products().map(p => ({
    id: p.id, label: `${p.sku} — ${p.name} (${p.quantityOnHand} in stock)`
  })));
  // A method (not a computed): it depends on pickProductId, a plain ngModel property, so it must
  // re-evaluate each change-detection cycle rather than track signal reads.
  sizeOptions() {
    const p = this.products().find(x => x.id === this.pickProductId);
    return (p?.variants ?? []).map(v => ({ id: v.id, label: `${v.size} (${v.quantityOnHand} in stock)` }));
  }

  private v = signal(0);
  subTotal = computed(() => { this.v(); return this.lines().reduce((s, l) => s + l.product.salePrice * l.quantity, 0); });
  linesTotal = computed(() => { this.v(); return this.lines().reduce((s, l) => s + l.finalPrice * l.quantity, 0); });
  lineDiscount = computed(() => this.subTotal() - this.linesTotal());
  servicesTotal = computed(() => this.services().reduce((s, x) => s + x.amount, 0));
  /** Order-level discount = promo + manual, clamped so it can't exceed the product total. */
  orderDiscount = computed(() => { this.v(); return Math.min(this.linesTotal(), this.promoDiscount() + Math.max(0, Number(this.manualDiscount) || 0)); });
  grandTotal = computed(() => this.linesTotal() - this.orderDiscount() + this.servicesTotal());

  constructor() {
    this.customerApi.list().subscribe(cs => this.customers.set(cs));
    this.productApi.list({ pageSize: 500, isActive: true }).subscribe(r => this.products.set(r.items));
  }

  touch() { this.v.update(n => n + 1); }

  // ---- sorting ----
  arrow(col: SortCol) { return this.sortCol() === col ? (this.sortAsc() ? '▲' : '▼') : ''; }
  sortBy(col: SortCol) {
    if (this.sortCol() === col) this.sortAsc.update(a => !a); else { this.sortCol.set(col); this.sortAsc.set(true); }
    const dir = this.sortAsc() ? 1 : -1;
    const key = (l: Line): number | string => {
      switch (col) {
        case 'product': return (l.product.sku + l.product.name).toLowerCase();
        case 'size': return l.variant.size.toLowerCase();
        case 'quantity': return l.quantity;
        case 'salePrice': return l.product.salePrice;
        case 'finalPrice': return l.finalPrice;
        case 'lineTotal': return l.finalPrice * l.quantity;
      }
    };
    this.lines.update(ls => [...ls].sort((a, b) => {
      const ka = key(a), kb = key(b);
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir;
    }));
  }

  // ---- new customer ----
  toggleNewCustomer() { this.showNewCustomer.update(s => !s); }
  saveNewCustomer() {
    const name = this.nc.name.trim();
    if (!name) { this.notify.error(null, 'Enter the customer name'); return; }
    this.savingCustomer.set(true);
    this.customerApi.create({ name, phone: this.nc.phone.trim() || null, email: this.nc.email.trim() || null }).subscribe({
      next: (c) => {
        this.customers.update(cs => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)));
        this.customerId = c.id;
        this.showNewCustomer.set(false);
        this.nc = { name: '', phone: '', email: '' };
        this.savingCustomer.set(false);
        this.notify.success(`Customer "${c.name}" added`);
      },
      error: (e) => { this.savingCustomer.set(false); this.notify.error(e); }
    });
  }

  pickVariants(): ProductVariant[] {
    return this.products().find(p => p.id === this.pickProductId)?.variants ?? [];
  }

  addLine() {
    const p = this.products().find(x => x.id === this.pickProductId);
    if (!p) { this.notify.error(null, 'Pick a product first'); return; }
    const variant = p.variants.find(v => v.id === this.pickVariantId);
    if (!variant) { this.notify.error(null, 'Pick a size'); return; }
    const qty = Math.max(1, Math.floor(this.pickQty || 1));
    if (qty > variant.quantityOnHand) { this.notify.error(null, `Only ${variant.quantityOnHand} of size ${variant.size} in stock`); return; }
    if (this.lines().find(l => l.variant.id === variant.id)) { this.notify.error(null, 'That size is already added — edit its quantity'); return; }
    this.lines.update(ls => [...ls, { product: p, variant, quantity: qty, finalPrice: variant.salePrice ?? p.salePrice }]);
    this.pickProductId = null; this.pickVariantId = null; this.pickQty = 1;
    this.touch();
  }

  removeLine(l: Line) { this.lines.update(ls => ls.filter(x => x !== l)); this.touch(); }

  addService() {
    const label = this.svcLabel.trim();
    const amount = Number(this.svcAmount);
    if (!label) { this.notify.error(null, 'Name the service'); return; }
    if (!amount || amount <= 0) { this.notify.error(null, 'Enter a service amount'); return; }
    this.services.update(ss => [...ss, { label, amount }]);
    this.svcLabel = ''; this.svcAmount = null;
  }
  removeService(i: number) { this.services.update(ss => ss.filter((_, idx) => idx !== i)); }

  applyPromo() {
    const code = this.promoInput.trim().toUpperCase();
    if (!code) return;
    const subtotal = this.linesTotal();
    if (subtotal <= 0) { this.promoOk.set(false); this.promoMsg.set('Add line items before applying a promo.'); return; }
    this.checkingPromo.set(true);
    this.promoApi.validate(code, subtotal).subscribe({
      next: (r) => {
        this.checkingPromo.set(false);
        this.promoOk.set(r.valid);
        this.promoMsg.set(r.message);
        this.promoDiscount.set(r.valid ? r.discountAmount : 0);
        this.appliedPromo.set(r.valid ? (r.code ?? code) : null);
        this.touch();
      },
      error: (e) => { this.checkingPromo.set(false); this.promoOk.set(false); this.promoDiscount.set(0); this.appliedPromo.set(null); this.notify.error(e); }
    });
  }

  submit() {
    if (!this.customerId || this.lines().length === 0) return;
    this.saving.set(true);
    const items: CreateOrderItem[] = this.lines().map(l => ({
      productId: l.product.id, quantity: l.quantity, finalPrice: l.finalPrice, productVariantId: l.variant.id
    }));
    // Local date → UTC midnight; null when it's today (server defaults to now).
    const picked = this.orderDateObj ? this.orderDateObj.toISOString().slice(0, 10) : this.today;
    const orderDate = picked !== this.today ? new Date(picked + 'T00:00:00Z').toISOString() : null;
    this.orderApi.create({
      customerId: this.customerId, notes: this.notes || null, items,
      charges: this.services(), orderDate,
      orderDiscount: this.orderDiscount(),
      promoCode: this.appliedPromo()
    }).subscribe({
      next: (o) => { this.notify.success(`Order ${o.orderNumber} created`); this.router.navigate(['/orders', o.id]); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
