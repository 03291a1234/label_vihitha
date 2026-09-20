import { Component, Inject, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CategoryApi, VendorApi, ProductApi, apiOrigin } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Category, Vendor, InventoryBill } from '../../core/models';
import { SearchSelectComponent } from '../../shared/search-select.component';

export interface BillProductsData { inventoryId: number; inventoryName: string; bill: InventoryBill; }
interface Row { vendorId: number | null; categoryId: number | null; sku: string; name: string; size: string; qty: number; cost: number | null; sale: number | null; }

@Component({
  selector: 'app-bill-products',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressBarModule, SearchSelectComponent
  ],
  template: `
    <h2 mat-dialog-title>Add products from bill — {{ data.inventoryName }}</h2>
    <mat-dialog-content>
      @if (busy()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="bar">
        <a class="bill-link" [href]="fileUrl(data.bill.fileUrl)" target="_blank" rel="noopener">
          <mat-icon>{{ isPdf(data.bill.fileUrl) ? 'picture_as_pdf' : 'image' }}</mat-icon>
          View bill: {{ data.bill.fileName }}
        </a>
        <div class="spacer"></div>
        <span class="muted">Prices in</span>
        <mat-button-toggle-group [value]="currency()" (change)="currency.set($event.value)" aria-label="Currency">
          <mat-button-toggle value="USD">USD</mat-button-toggle>
          <mat-button-toggle value="INR">INR</mat-button-toggle>
        </mat-button-toggle-group>
      </div>
      <p class="muted intro">Read the bill and add a row per product. Set each row's vendor so a single bill can
        span multiple vendors; products are created in <strong>{{ data.inventoryName }}</strong>.</p>

      @for (r of rows(); track $index) {
        <div class="prow">
          <app-search-select class="w-vendor" label="Vendor" [items]="vendors()" [(ngModel)]="r.vendorId" />
          <app-search-select class="w-cat" label="Category" [items]="categories()" [(ngModel)]="r.categoryId" />
          <mat-form-field class="w-sku"><mat-label>SKU</mat-label><input matInput [(ngModel)]="r.sku" /></mat-form-field>
          <mat-form-field class="w-name"><mat-label>Product name</mat-label><input matInput [(ngModel)]="r.name" /></mat-form-field>
          <mat-form-field class="w-size"><mat-label>Size</mat-label><input matInput [(ngModel)]="r.size" placeholder="One Size" /></mat-form-field>
          <mat-form-field class="w-qty"><mat-label>Qty</mat-label><input matInput type="number" min="0" [(ngModel)]="r.qty" /></mat-form-field>
          <mat-form-field class="w-price"><mat-label>Cost {{ sym() }}</mat-label><input matInput type="number" min="0" step="0.01" [(ngModel)]="r.cost" /></mat-form-field>
          <mat-form-field class="w-price"><mat-label>Sale {{ sym() }}</mat-label><input matInput type="number" min="0" step="0.01" [(ngModel)]="r.sale" /></mat-form-field>
          <button mat-icon-button color="warn" (click)="removeRow($index)" [disabled]="rows().length === 1"><mat-icon>close</mat-icon></button>
        </div>
      }

      <button mat-stroked-button (click)="addRow()"><mat-icon>add</mat-icon> Add product row</button>

      <div class="summary">
        <span>{{ validCount() }} product(s) ready</span>
        <span class="muted">Total cost {{ sym() }}{{ totalCost() | number:'1.0-2' }}
          <span class="inr">≈ {{ currency() === 'USD' ? '₹' + (totalCost() * 95 | number:'1.0-0') : '$' + (totalCost() / 95 | number:'1.0-2') }}</span></span>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(created > 0)">Close</button>
      <button mat-raised-button color="primary" (click)="createAll()" [disabled]="validCount() === 0 || busy()">
        <mat-icon>playlist_add</mat-icon> Create {{ validCount() }} product(s)
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: min(720px, 90vw); }
    .bar { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
    .bar .spacer { flex: 1; }
    .bill-link { display: inline-flex; align-items: center; gap: 4px; color: var(--lv-wine); font-weight: 600; text-decoration: none;
      background: var(--lv-rose-soft); padding: 4px 12px; border-radius: 999px; }
    .bill-link:hover { text-decoration: underline; }
    .bill-link mat-icon { font-size: 18px; height: 18px; width: 18px; }
    .intro { margin: 4px 0 12px; font-size: 13px; }
    .prow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 6px 0; border-bottom: 1px solid #f4eef1; }
    .w-vendor { width: 150px; } .w-cat { width: 140px; } .w-sku { width: 110px; } .w-name { flex: 1; min-width: 150px; }
    .w-size { width: 90px; } .w-qty { width: 70px; } .w-price { width: 95px; }
    .prow app-search-select { display: inline-block; }
    .summary { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px;
      border-top: 1px solid var(--lv-line); font-weight: 600; }
    .summary .inr { color: rgba(58,37,48,.55); font-weight: 400; margin-left: 6px; font-size: 12px; }
    .muted { color: rgba(58,37,48,.6); }
  `]
})
export class BillProductsDialog {
  private catApi = inject(CategoryApi);
  private vendorApi = inject(VendorApi);
  private productApi = inject(ProductApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<BillProductsDialog>);

  categories = signal<Category[]>([]);
  vendors = signal<Vendor[]>([]);
  currency = signal<'USD' | 'INR'>('USD');
  busy = signal(false);
  created = 0;

  rows = signal<Row[]>([this.blank()]);

  constructor(@Inject(MAT_DIALOG_DATA) public data: BillProductsData) {
    this.catApi.list(false).subscribe(cs => this.categories.set(cs));
    this.vendorApi.list(false).subscribe(vs => this.vendors.set(vs));
  }

  sym = computed(() => this.currency() === 'USD' ? '$' : '₹');
  private blank(): Row { return { vendorId: null, categoryId: null, sku: '', name: '', size: '', qty: 1, cost: null, sale: null }; }
  isPdf(url: string) { return url.toLowerCase().endsWith('.pdf'); }
  fileUrl(url: string) { return url.startsWith('http') ? url : apiOrigin + url; }

  addRow() {
    // Inherit vendor + category from the last row to speed same-vendor entry.
    const last = this.rows().at(-1);
    this.rows.update(rs => [...rs, { ...this.blank(), vendorId: last?.vendorId ?? null, categoryId: last?.categoryId ?? null }]);
  }
  removeRow(i: number) { this.rows.update(rs => rs.filter((_, idx) => idx !== i)); }

  private isValid(r: Row) { return !!r.categoryId && !!r.sku.trim() && !!r.name.trim() && Number(r.qty) > 0; }
  validCount = computed(() => this.rows().filter(r => this.isValid(r)).length);
  totalCost = computed(() => this.rows().reduce((s, r) => s + (Number(r.cost) || 0) * (Number(r.qty) || 0), 0));

  private toUsd(v: number | null) { const n = Number(v) || 0; return this.currency() === 'INR' ? n / 95 : n; }

  createAll() {
    const valid = this.rows().filter(r => this.isValid(r));
    if (valid.length === 0) return;
    this.busy.set(true);
    const calls = valid.map(r => {
      const cost = this.toUsd(r.cost);
      const sale = r.sale != null ? this.toUsd(r.sale) : cost;
      const size = r.size.trim() || 'One Size';
      return this.productApi.create({
        categoryId: r.categoryId, vendorId: r.vendorId, inventoryId: this.data.inventoryId,
        sku: r.sku.trim(), name: r.name.trim(),
        originalPrice: Math.round(cost * 100) / 100, salePrice: Math.round(sale * 100) / 100,
        quantityOnHand: Number(r.qty), reorderThreshold: 0,
        variants: [{ size, quantityOnHand: Number(r.qty) }]
      }).pipe(map(() => ({ ok: true, sku: r.sku })), catchError(() => of({ ok: false, sku: r.sku })));
    });
    forkJoin(calls).subscribe(results => {
      this.busy.set(false);
      const ok = results.filter(x => x.ok).length;
      const fail = results.filter(x => !x.ok);
      this.created += ok;
      if (ok > 0) this.notify.success(`Created ${ok} product(s) in ${this.data.inventoryName}`);
      if (fail.length) this.notify.error(null, `${fail.length} failed (check for duplicate SKUs: ${fail.map(f => f.sku).join(', ')})`);
      // Drop the successfully-created rows, keep any that failed for correction.
      const failedSkus = new Set(fail.map(f => f.sku));
      this.rows.update(rs => {
        const kept = rs.filter(r => !this.isValid(r) || failedSkus.has(r.sku.trim()));
        return kept.length ? kept : [this.blank()];
      });
    });
  }
}
