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
import { MatSelectModule } from '@angular/material/select';
import { CustomerApi, OrderApi, ProductApi, CreateOrderItem } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Customer, Product } from '../../core/models';

interface Line { product: Product; quantity: number; finalPrice: number; }

@Component({
  selector: 'app-order-create',
  standalone: true,
  imports: [
    CurrencyPipe, FormsModule, RouterLink, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1><button mat-icon-button routerLink="/orders"><mat-icon>arrow_back</mat-icon></button> New order</h1>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <mat-form-field style="width:100%;max-width:420px;">
          <mat-label>Customer</mat-label>
          <mat-select [(ngModel)]="customerId">
            @for (c of customers(); track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field style="width:100%;">
          <mat-label>Order notes</mat-label>
          <textarea matInput rows="2" [(ngModel)]="notes" placeholder="Alteration requests, special instructions…"></textarea>
        </mat-form-field>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3>Add line item</h3>
        <div class="toolbar-row">
          <mat-form-field style="min-width:280px;">
            <mat-label>Product</mat-label>
            <mat-select [(ngModel)]="pickProductId">
              @for (p of products(); track p.id) {
                <mat-option [value]="p.id" [disabled]="p.quantityOnHand < 1">
                  {{ p.sku }} — {{ p.name }} ({{ p.quantityOnHand }} in stock)
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field style="width:120px;">
            <mat-label>Qty</mat-label>
            <input matInput type="number" min="1" [(ngModel)]="pickQty" />
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="addLine()"><mat-icon>add</mat-icon> Add</button>
        </div>
      </div>

      <div class="card">
        <table mat-table [dataSource]="lines()" class="full">
          <ng-container matColumnDef="product">
            <th mat-header-cell *matHeaderCellDef>Product</th>
            <td mat-cell *matCellDef="let l"><strong>{{ l.product.sku }}</strong> {{ l.product.name }}</td>
          </ng-container>
          <ng-container matColumnDef="quantity">
            <th mat-header-cell *matHeaderCellDef class="text-right">Qty</th>
            <td mat-cell *matCellDef="let l" class="text-right">
              <input class="inline-num" type="number" min="1" [max]="l.product.quantityOnHand"
                     [(ngModel)]="l.quantity" (ngModelChange)="touch()" />
            </td>
          </ng-container>
          <ng-container matColumnDef="salePrice">
            <th mat-header-cell *matHeaderCellDef class="text-right">List</th>
            <td mat-cell *matCellDef="let l" class="text-right mono">{{ l.product.salePrice | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="finalPrice">
            <th mat-header-cell *matHeaderCellDef class="text-right">Final / unit</th>
            <td mat-cell *matCellDef="let l" class="text-right">
              <input class="inline-num" type="number" min="0" [(ngModel)]="l.finalPrice" (ngModelChange)="touch()" />
            </td>
          </ng-container>
          <ng-container matColumnDef="lineTotal">
            <th mat-header-cell *matHeaderCellDef class="text-right">Line total</th>
            <td mat-cell *matCellDef="let l" class="text-right mono">{{ l.finalPrice * l.quantity | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let l; let i = index" class="text-right">
              <button mat-icon-button color="warn" (click)="removeLine(i)"><mat-icon>close</mat-icon></button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (lines().length === 0) { <div class="empty-state">No line items yet — add a product above.</div> }

        <div class="totals">
          <div><span class="muted">Subtotal (list)</span> <span class="mono">{{ subTotal() | currency }}</span></div>
          <div><span class="muted">Discount</span> <span class="mono">−{{ discountTotal() | currency }}</span></div>
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
    .totals { margin-top: 16px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .totals > div { display: flex; gap: 24px; min-width: 260px; justify-content: space-between; }
    .totals .grand { font-size: 18px; font-weight: 600; border-top: 1px solid #eee; padding-top: 8px; margin-top: 4px; }
  `]
})
export class OrderCreateComponent {
  private customerApi = inject(CustomerApi);
  private productApi = inject(ProductApi);
  private orderApi = inject(OrderApi);
  private notify = inject(Notify);
  private router = inject(Router);

  customers = signal<Customer[]>([]);
  products = signal<Product[]>([]);
  lines = signal<Line[]>([]);
  saving = signal(false);

  customerId: number | null = null;
  notes = '';
  pickProductId: number | null = null;
  pickQty = 1;
  cols = ['product', 'quantity', 'salePrice', 'finalPrice', 'lineTotal', 'actions'];

  // Recompute triggers via a version signal bumped on edits.
  private v = signal(0);
  subTotal = computed(() => { this.v(); return this.lines().reduce((s, l) => s + l.product.salePrice * l.quantity, 0); });
  grandTotal = computed(() => { this.v(); return this.lines().reduce((s, l) => s + l.finalPrice * l.quantity, 0); });
  discountTotal = computed(() => this.subTotal() - this.grandTotal());

  constructor() {
    this.customerApi.list().subscribe(cs => this.customers.set(cs));
    this.productApi.list({ pageSize: 200, isActive: true }).subscribe(r => this.products.set(r.items));
  }

  touch() { this.v.update(n => n + 1); }

  addLine() {
    const p = this.products().find(x => x.id === this.pickProductId);
    if (!p) { this.notify.error(null, 'Pick a product first'); return; }
    const qty = Math.max(1, Math.floor(this.pickQty || 1));
    if (qty > p.quantityOnHand) { this.notify.error(null, `Only ${p.quantityOnHand} in stock`); return; }
    const existing = this.lines().find(l => l.product.id === p.id);
    if (existing) { this.notify.error(null, 'Product already added — edit its quantity'); return; }
    this.lines.update(ls => [...ls, { product: p, quantity: qty, finalPrice: p.salePrice }]);
    this.pickProductId = null; this.pickQty = 1;
    this.touch();
  }

  removeLine(i: number) { this.lines.update(ls => ls.filter((_, idx) => idx !== i)); this.touch(); }

  submit() {
    if (!this.customerId || this.lines().length === 0) return;
    this.saving.set(true);
    const items: CreateOrderItem[] = this.lines().map(l => ({
      productId: l.product.id, quantity: l.quantity, finalPrice: l.finalPrice
    }));
    this.orderApi.create({ customerId: this.customerId, notes: this.notes || null, items }).subscribe({
      next: (o) => { this.notify.success(`Order ${o.orderNumber} created`); this.router.navigate(['/orders', o.id]); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
