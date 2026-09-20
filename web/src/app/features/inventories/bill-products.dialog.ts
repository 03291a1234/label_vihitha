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
import { catchError, map, switchMap } from 'rxjs/operators';
import { CategoryApi, VendorApi, ProductApi, apiOrigin } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Category, Vendor, InventoryBill } from '../../core/models';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { SettingsService } from '../../core/services/settings.service';

/** Optional bill: when present the dialog links to it; otherwise it's a plain per-inventory bulk add. */
export interface BillProductsData { inventoryId: number; inventoryName: string; bill?: InventoryBill | null; }
interface Row {
  vendorId: number | null; categoryId: number | null; sku: string; name: string; size: string;
  qty: number; rate: number | null;
  cost: number | null; costOverride: boolean;
  sale: number | null; saleOverride: boolean;
}

@Component({
  selector: 'app-bill-products',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressBarModule, SearchSelectComponent
  ],
  template: `
    <h2 mat-dialog-title>Bulk add products — {{ data.inventoryName }}</h2>
    <mat-dialog-content>
      @if (busy()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="bar">
        @if (data.bill?.fileUrl) {
          <a class="bill-link" [href]="fileUrl(data.bill!.fileUrl)" target="_blank" rel="noopener">
            <mat-icon>{{ isPdf(data.bill!.fileUrl) ? 'picture_as_pdf' : 'image' }}</mat-icon>
            View bill: {{ data.bill!.fileName }}
          </a>
        }
        <div class="spacer"></div>
        <span class="muted">Prices in</span>
        <mat-button-toggle-group [value]="currency()" (change)="currency.set($event.value)" aria-label="Currency">
          <mat-button-toggle value="USD">USD</mat-button-toggle>
          <mat-button-toggle value="INR">INR</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <!-- Paste lines -->
      <details class="paste" #pastePanel>
        <summary><mat-icon>content_paste</mat-icon> Paste lines from an invoice</summary>
        <p class="muted hint">One product per line as <strong>Name, Qty, Rate</strong> (comma or tab separated). A 4th
          "Amount" column is ignored. Rate is the per-unit purchase price in {{ currency() }}.</p>
        <textarea [(ngModel)]="pasteText" rows="4" placeholder="Anarkali Suit, 25, 1720&#10;Banarasi Saree, 2, 6045"></textarea>
        <div class="paste-actions">
          <button mat-stroked-button (click)="applyPaste()" [disabled]="!pasteText.trim()"><mat-icon>playlist_add</mat-icon> Add {{ pasteCount() }} line(s)</button>
          <button mat-button (click)="pasteText=''">Clear</button>
        </div>
      </details>

      <!-- Batch pricing -->
      <div class="pricing">
        <span class="pt">Batch pricing</span>
        <mat-form-field class="pnum"><mat-label>GST %</mat-label>
          <input matInput type="number" min="0" step="0.5" [ngModel]="gstPct()" (ngModelChange)="gstPct.set(+$event); recomputeAll()" /></mat-form-field>
        <mat-form-field class="pnum"><mat-label>Discount %</mat-label>
          <input matInput type="number" min="0" step="0.5" [ngModel]="discountPct()" (ngModelChange)="discountPct.set(+$event); recomputeAll()" /></mat-form-field>
        <span class="arrow">→ cost</span>
        <mat-form-field class="pnum"><mat-label>Markup %</mat-label>
          <input matInput type="number" min="0" step="5" [ngModel]="markupPct()" (ngModelChange)="markupPct.set(+$event); recomputeAll()" /></mat-form-field>
        <mat-form-field class="pnum"><mat-label>Round {{ sym() }}</mat-label>
          <input matInput type="number" min="0" step="10" [ngModel]="roundTo()" (ngModelChange)="roundTo.set(+$event); recomputeAll()" /></mat-form-field>
        <span class="arrow">→ sale</span>
        <button mat-button class="reset" (click)="resetOverrides()" title="Recompute every row from the rules above">
          <mat-icon>restart_alt</mat-icon> Reset edits</button>
      </div>

      <!-- Defaults applied to blank cells -->
      <div class="defaults">
        <span class="pt">Apply to all</span>
        <app-search-select class="w-vendor" label="Vendor" [items]="vendors()" [(ngModel)]="defVendorId" />
        <app-search-select class="w-cat" label="Category" [items]="categories()" [(ngModel)]="defCategoryId" />
        <mat-form-field class="w-size"><mat-label>Size</mat-label><input matInput [(ngModel)]="defSize" placeholder="Free Size" /></mat-form-field>
        <button mat-stroked-button (click)="applyDefaults()"><mat-icon>done_all</mat-icon> Fill blanks</button>
      </div>

      @for (r of rows(); track $index) {
        <div class="prow">
          <app-search-select class="w-vendor" label="Vendor" [items]="vendors()" [(ngModel)]="r.vendorId" />
          <app-search-select class="w-cat" label="Category" [items]="categories()" [(ngModel)]="r.categoryId" />
          <mat-form-field class="w-sku"><mat-label>SKU</mat-label><input matInput [(ngModel)]="r.sku" placeholder="auto" /></mat-form-field>
          <mat-form-field class="w-name"><mat-label>Product name</mat-label><input matInput [(ngModel)]="r.name" /></mat-form-field>
          <mat-form-field class="w-size"><mat-label>Size</mat-label><input matInput [(ngModel)]="r.size" placeholder="Free Size" /></mat-form-field>
          <mat-form-field class="w-qty"><mat-label>Qty</mat-label><input matInput type="number" min="0" [(ngModel)]="r.qty" /></mat-form-field>
          <mat-form-field class="w-rate"><mat-label>Rate {{ sym() }}</mat-label>
            <input matInput type="number" min="0" step="0.01" [ngModel]="r.rate" (ngModelChange)="r.rate=+$event; recompute(r)" /></mat-form-field>
          <mat-form-field class="w-price"><mat-label>Cost {{ sym() }}</mat-label>
            <input matInput type="number" min="0" step="0.01" [ngModel]="r.cost" (ngModelChange)="onCostEdit(r, $event)"
              [class.calc]="!r.costOverride" /></mat-form-field>
          <mat-form-field class="w-price"><mat-label>Sale {{ sym() }}</mat-label>
            <input matInput type="number" min="0" step="0.01" [ngModel]="r.sale" (ngModelChange)="onSaleEdit(r, $event)"
              [class.calc]="!r.saleOverride" /></mat-form-field>
          <button mat-icon-button color="warn" (click)="removeRow($index)" [disabled]="rows().length === 1"><mat-icon>close</mat-icon></button>
        </div>
      }

      <button mat-stroked-button (click)="addRow()"><mat-icon>add</mat-icon> Add product row</button>

      <div class="summary">
        <span>{{ validCount() }} product(s) ready</span>
        <div class="totals">
          <span class="muted">Cost {{ sym() }}{{ totalCost() | number:'1.0-2' }}
            <span class="inr">≈ {{ currency() === 'USD' ? '₹' + (totalCost() * rate | number:'1.0-0') : '$' + (totalCost() / rate | number:'1.0-2') }}</span></span>
          <span class="muted">· Sale {{ sym() }}{{ totalSale() | number:'1.0-2' }}</span>
          <mat-form-field class="w-recon"><mat-label>Invoice total {{ sym() }}</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="invoiceTotal" /></mat-form-field>
          @if (reconDiff() !== null) {
            <span class="recon" [class.ok]="reconOk()">{{ reconOk() ? 'ties out' : (reconDiff()! > 0 ? '+' : '') + sym() + (reconDiff() | number:'1.0-2') }}</span>
          }
        </div>
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
    mat-dialog-content { min-width: min(880px, 94vw); }
    .bar { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .bar .spacer { flex: 1; }
    .bill-link { display: inline-flex; align-items: center; gap: 4px; color: var(--lv-wine); font-weight: 600; text-decoration: none;
      background: var(--lv-rose-soft); padding: 4px 12px; border-radius: 999px; }
    .bill-link:hover { text-decoration: underline; }
    .bill-link mat-icon { font-size: 18px; height: 18px; width: 18px; }

    .paste { border: 1px solid var(--lv-line); border-radius: 10px; padding: 8px 12px; margin-bottom: 10px; background: #fffdfb; }
    .paste summary { cursor: pointer; font-weight: 600; color: var(--lv-wine); display: flex; align-items: center; gap: 6px; }
    .paste summary mat-icon { font-size: 18px; height: 18px; width: 18px; }
    .paste .hint { margin: 8px 0; font-size: 12px; }
    .paste textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--lv-line); border-radius: 8px; padding: 8px; font: inherit; }
    .paste-actions { display: flex; gap: 8px; margin-top: 8px; }

    .pricing, .defaults { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 0; }
    .pricing { border-top: 1px solid var(--lv-line); }
    .defaults { border-bottom: 1px solid var(--lv-line); margin-bottom: 8px; }
    .pt { font-weight: 600; color: var(--lv-wine); font-size: 13px; margin-right: 4px; }
    .arrow { color: rgba(58,37,48,.5); font-size: 12px; }
    .pnum { width: 92px; } .reset { margin-left: auto; }

    .prow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 6px 0; border-bottom: 1px solid #f4eef1; }
    .w-vendor { width: 140px; } .w-cat { width: 130px; } .w-sku { width: 100px; } .w-name { flex: 1; min-width: 140px; }
    .w-size { width: 90px; } .w-qty { width: 66px; } .w-rate { width: 92px; } .w-price { width: 92px; }
    .prow app-search-select { display: inline-block; }
    /* Calculated (non-overridden) cost/sale read as muted so edits stand out. */
    input.calc { color: rgba(58,37,48,.7); }

    .summary { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; padding-top: 10px;
      border-top: 1px solid var(--lv-line); font-weight: 600; flex-wrap: wrap; }
    .summary .totals { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .summary .inr { color: rgba(58,37,48,.55); font-weight: 400; margin-left: 4px; font-size: 12px; }
    .w-recon { width: 130px; }
    .recon { font-weight: 700; color: #b0324f; } .recon.ok { color: #226b39; }
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
  currency = signal<'USD' | 'INR'>('INR');
  busy = signal(false);
  created = 0;

  // Batch pricing rules
  gstPct = signal(5);
  discountPct = signal(0);
  markupPct = signal(50);
  roundTo = signal(100);

  // Row defaults
  defVendorId: number | null = null;
  defCategoryId: number | null = null;
  defSize = 'Free Size';

  pasteText = '';
  invoiceTotal: number | null = null;

  rows = signal<Row[]>([this.blank()]);

  constructor(@Inject(MAT_DIALOG_DATA) public data: BillProductsData) {
    this.catApi.list(false).subscribe(cs => this.categories.set(cs));
    this.vendorApi.list(false).subscribe(vs => this.vendors.set(vs));
    // Seed defaults from the bill's vendor when opened from a bill.
    if (this.data.bill?.vendorId) this.defVendorId = this.data.bill.vendorId;
  }

  sym = computed(() => this.currency() === 'USD' ? '$' : '₹');
  private blank(): Row {
    return { vendorId: null, categoryId: null, sku: '', name: '', size: '', qty: 1, rate: null,
      cost: null, costOverride: false, sale: null, saleOverride: false };
  }
  isPdf(url: string) { return url.toLowerCase().endsWith('.pdf'); }
  fileUrl(url: string) { return url.startsWith('http') ? url : apiOrigin + url; }

  private round2(n: number) { return Math.round(n * 100) / 100; }

  /** Recompute one row's cost (from rate + GST − discount) and sale (cost × markup, rounded), skipping overrides. */
  recompute(r: Row) {
    if (!r.costOverride && r.rate != null) {
      const gst = 1 + (this.gstPct() || 0) / 100;
      const disc = 1 - (this.discountPct() || 0) / 100;
      r.cost = this.round2(r.rate * gst * disc);
    }
    if (!r.saleOverride && r.cost != null) {
      let s = r.cost * (1 + (this.markupPct() || 0) / 100);
      const rt = this.roundTo() || 0;
      if (rt > 0) s = Math.round(s / rt) * rt;
      r.sale = this.round2(s);
    }
    this.rows.update(rs => [...rs]);
  }
  recomputeAll() { this.rows().forEach(r => this.recompute(r)); }
  resetOverrides() { this.rows().forEach(r => { r.costOverride = false; r.saleOverride = false; this.recompute(r); }); }

  onCostEdit(r: Row, v: string) { r.cost = v === '' ? null : +v; r.costOverride = true; this.recompute(r); }
  onSaleEdit(r: Row, v: string) { r.sale = v === '' ? null : +v; r.saleOverride = true; this.rows.update(rs => [...rs]); }

  // ---- Paste ----
  private parsePaste(): { name: string; qty: number; rate: number }[] {
    return this.pasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split(/\t|,|\s{2,}/).map(p => p.trim()).filter(p => p !== '');
      if (parts.length < 3) return null;
      const name = parts[0];
      const qty = parseInt(parts[1], 10);
      const rate = parseFloat(parts[2]);
      if (!name || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate)) return null;
      return { name, qty, rate };
    }).filter((x): x is { name: string; qty: number; rate: number } => x !== null);
  }
  pasteCount() { return this.parsePaste().length; }
  applyPaste() {
    const parsed = this.parsePaste();
    if (!parsed.length) { this.notify.error(null, 'No valid "Name, Qty, Rate" lines found'); return; }
    const newRows = parsed.map(p => {
      const r: Row = { ...this.blank(), name: p.name, qty: p.qty, rate: p.rate,
        vendorId: this.defVendorId, categoryId: this.defCategoryId, size: this.defSize };
      this.recompute(r);
      return r;
    });
    // Drop a single empty starter row when pasting the first batch.
    this.rows.update(rs => {
      const base = (rs.length === 1 && this.isEmpty(rs[0])) ? [] : rs;
      return [...base, ...newRows];
    });
    this.pasteText = '';
  }
  private isEmpty(r: Row) { return !r.name.trim() && r.rate == null && !r.sku.trim(); }

  applyDefaults() {
    // Clone each row so the child search-selects get a fresh ngModel identity and refresh their display.
    this.rows.update(rs => rs.map(r => ({
      ...r,
      vendorId: r.vendorId ?? this.defVendorId,
      categoryId: r.categoryId ?? this.defCategoryId,
      size: r.size.trim() ? r.size : (this.defSize.trim() || r.size)
    })));
  }

  addRow() {
    const last = this.rows().at(-1);
    this.rows.update(rs => [...rs, { ...this.blank(),
      vendorId: last?.vendorId ?? this.defVendorId, categoryId: last?.categoryId ?? this.defCategoryId, size: this.defSize }]);
  }
  removeRow(i: number) { this.rows.update(rs => rs.filter((_, idx) => idx !== i)); }

  private isValid(r: Row) { return !!r.categoryId && !!r.name.trim() && Number(r.qty) > 0; }
  validCount = computed(() => this.rows().filter(r => this.isValid(r)).length);
  totalCost = computed(() => this.rows().reduce((s, r) => s + (Number(r.cost) || 0) * (Number(r.qty) || 0), 0));
  totalSale = computed(() => this.rows().reduce((s, r) => s + (Number(r.sale) || 0) * (Number(r.qty) || 0), 0));
  reconDiff() { return this.invoiceTotal == null ? null : this.round2(this.totalCost() - this.invoiceTotal); }
  reconOk() { const d = this.reconDiff(); return d !== null && Math.abs(d) < 1; }

  private settings = inject(SettingsService);
  get rate() { return this.settings.inrPerUsd(); }
  private toUsd(v: number | null) { const n = Number(v) || 0; return this.currency() === 'INR' ? n / this.rate : n; }

  createAll() {
    const valid = this.rows().filter(r => this.isValid(r));
    if (valid.length === 0) return;
    this.busy.set(true);
    // Assign SKUs for blank rows: one next-sku lookup per distinct vendor, then increment locally.
    const needSku = valid.filter(r => !r.sku.trim());
    const vendorIds = [...new Set(needSku.map(r => r.vendorId ?? 0))];
    const skuSeeds = vendorIds.length
      ? forkJoin(Object.fromEntries(vendorIds.map(vid =>
          [vid, this.productApi.nextSku(null, null, vid || null).pipe(catchError(() => of({ sku: 'PRD-0001' })))])))
      : of({} as Record<number, { sku: string }>);

    skuSeeds.pipe(switchMap(seeds => {
      const counters = new Map<number, { prefix: string; next: number }>();
      const used = new Set(valid.map(r => r.sku.trim().toUpperCase()).filter(Boolean));
      for (const vid of vendorIds) {
        const seed = (seeds as Record<number, { sku: string }>)[vid]?.sku ?? 'PRD-0001';
        const m = /^(.*)-(\d+)$/.exec(seed);
        counters.set(vid, { prefix: m ? m[1] : seed, next: m ? parseInt(m[2], 10) : 1 });
      }
      const nextSkuFor = (vid: number) => {
        const c = counters.get(vid)!;
        let sku = '';
        do { sku = `${c.prefix}-${String(c.next).padStart(4, '0')}`; c.next++; } while (used.has(sku.toUpperCase()));
        used.add(sku.toUpperCase());
        return sku;
      };
      const calls = valid.map(r => {
        const cost = this.toUsd(r.cost);
        const sale = r.sale != null ? this.toUsd(r.sale) : cost;
        const size = r.size.trim() || 'Free Size';
        const sku = r.sku.trim() || nextSkuFor(r.vendorId ?? 0);
        return this.productApi.create({
          categoryId: r.categoryId, vendorId: r.vendorId, inventoryId: this.data.inventoryId,
          sku, name: r.name.trim(),
          originalPrice: this.round2(cost), salePrice: this.round2(sale),
          quantityOnHand: Number(r.qty), reorderThreshold: 0,
          variants: [{ size, quantityOnHand: Number(r.qty), costPrice: this.round2(cost), salePrice: this.round2(sale) }]
        }).pipe(map(() => ({ ok: true, sku })), catchError(() => of({ ok: false, sku })));
      });
      return forkJoin(calls);
    })).subscribe(results => {
      this.busy.set(false);
      const ok = results.filter(x => x.ok).length;
      const fail = results.filter(x => !x.ok);
      this.created += ok;
      if (ok > 0) this.notify.success(`Created ${ok} product(s) in ${this.data.inventoryName}`);
      if (fail.length) this.notify.error(null, `${fail.length} failed (duplicate SKUs? ${fail.map(f => f.sku).join(', ')})`);
      const failedSkus = new Set(fail.map(f => f.sku));
      this.rows.update(rs => {
        const kept = rs.filter(r => !this.isValid(r) || failedSkus.has(r.sku.trim()));
        return kept.length ? kept : [this.blank()];
      });
    });
  }
}