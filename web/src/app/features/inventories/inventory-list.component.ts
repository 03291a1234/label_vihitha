import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { InventoryApi, ProductApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { Inventory, SubCategoryCount } from '../../core/models';
import { printProductLabels } from '../../shared/label-print';
import { InventoryEditDialog } from './inventory-edit.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';
import { InrAmountPipe } from '../../shared/inr-amount.pipe';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [
    InrAmountPipe,
    CurrencyPipe, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatMenuModule,
    MatDialogModule, MatProgressBarModule, MatSlideToggleModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Inventories</h1>
        <div class="toolbar-row">
          <mat-slide-toggle [(ngModel)]="includeInactive" (change)="load()">Show inactive</mat-slide-toggle>
          @if (auth.canManageInventory()) {
            <button mat-raised-button color="primary" (click)="openEdit(null)">
              <mat-icon>add</mat-icon> New inventory
            </button>
          }
        </div>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      @for (i of rows(); track i.id) {
        <div class="card inv-card">
          <div class="inv-head">
            <div class="inv-title">
              <strong>{{ i.name }}</strong>
              @if (!i.isActive) { <span class="chip Cancelled">inactive</span> }
              @if (!i.isVisibleOnStore) { <span class="chip off-store"><mat-icon>visibility_off</mat-icon>Hidden on store</span> }
              @if (i.paidByOwnerName) { <span class="paid-by"><mat-icon>account_balance_wallet</mat-icon>{{ i.paidByOwnerName }}</span> }
              <div class="muted">{{ i.description }}</div>
            </div>
            <div class="inv-stats">
              <div class="stat"><span class="v">{{ i.productCount }}</span><span class="l">products</span></div>
              <div class="stat"><span class="v">{{ i.totalUnits }}</span><span class="l">units</span></div>
              <div class="stat cost">
                <span class="v">{{ i.totalCostUsd | currency:'USD':'symbol':'1.0-0' }}</span>
                <span class="l">at cost</span>
                <span class="inr">≈ {{ i.totalCostUsd | inrAmount | currency:'INR':'symbol':'1.0-0' }}</span>
              </div>
              @if (i.totalBillsUsd > 0) {
                <div class="stat cost">
                  <span class="v">{{ i.totalBillsUsd | currency:'USD':'symbol':'1.0-0' }}</span>
                  <span class="l">billed</span>
                  <span class="inr">≈ {{ i.totalBillsUsd | inrAmount | currency:'INR':'symbol':'1.0-0' }}</span>
                </div>
              }
            </div>
            <div class="inv-actions">
              <button mat-stroked-button [routerLink]="['/products']" [queryParams]="{ inventoryId: i.id }">
                <mat-icon>inventory_2</mat-icon> View products
              </button>
              <button mat-stroked-button [matMenuTriggerFor]="labelMenu" [matMenuTriggerData]="{ inv: i }"
                      [disabled]="!i.productCount || printingId() === i.id">
                <mat-icon>label</mat-icon> Print labels
              </button>
              @if (auth.canManageInventory()) {
                <mat-slide-toggle class="store-toggle" [checked]="i.isVisibleOnStore"
                    [disabled]="togglingId() === i.id" (change)="toggleStore(i, $event.checked)">
                  <span class="st-label"><mat-icon>storefront</mat-icon> On storefront</span>
                </mat-slide-toggle>
                <button mat-stroked-button (click)="openEdit(i)"><mat-icon>edit</mat-icon> Manage</button>
                <button mat-icon-button color="warn" (click)="remove(i)" title="Delete"><mat-icon>delete</mat-icon></button>
              }
            </div>
          </div>

          <div class="perf">
            <div class="pcell">
              <span class="pl">Initial total cost</span>
              <span class="pv">{{ i.initialCostUsd | currency:'USD':'symbol':'1.0-0' }}</span>
              <span class="pinr">≈ {{ i.initialCostUsd | inrAmount | currency:'INR':'symbol':'1.0-0' }}</span>
            </div>
            <div class="pcell">
              <span class="pl">Current inventory cost</span>
              <span class="pv">{{ i.totalCostUsd | currency:'USD':'symbol':'1.0-0' }}</span>
              <span class="pinr">≈ {{ i.totalCostUsd | inrAmount | currency:'INR':'symbol':'1.0-0' }}</span>
            </div>
            <div class="pcell">
              <span class="pl">Sale amount</span>
              <span class="pv">{{ i.soldRevenueUsd | currency:'USD':'symbol':'1.0-0' }}</span>
              <span class="pinr">≈ {{ i.soldRevenueUsd | inrAmount | currency:'INR':'symbol':'1.0-0' }}</span>
            </div>
            <div class="pcell">
              <span class="pl">Gross P&amp;L</span>
              <span class="pv" [class.pos]="i.profitUsd >= 0" [class.neg]="i.profitUsd < 0">{{ signed(i.profitUsd) }}</span>
              <span class="pinr">sale − cost of goods</span>
            </div>
            <div class="pcell">
              <span class="pl">Expenses (allocated)</span>
              <span class="pv neg">−{{ i.allocatedExpenseUsd | currency:'USD':'symbol':'1.0-0' }}</span>
              <span class="pinr">by share of sales</span>
            </div>
            <div class="pcell">
              <span class="pl">Net P&amp;L</span>
              <span class="pv" [class.pos]="i.netProfitUsd >= 0" [class.neg]="i.netProfitUsd < 0">{{ signed(i.netProfitUsd) }}</span>
              <span class="pinr">{{ i.netProfitUsd >= 0 ? '≈ ' : '≈ −' }}{{ (i.netProfitUsd < 0 ? -i.netProfitUsd : i.netProfitUsd) | inrAmount | currency:'INR':'symbol':'1.0-0' }}</span>
            </div>
          </div>

          @if (i.categories.length > 0) {
            <div class="breakdown">
              @for (c of i.categories; track c.categoryId) {
                <div class="cat-block">
                  <a class="cat-head" [routerLink]="['/products']"
                     [queryParams]="{ inventoryId: i.id, categoryId: c.categoryId }" title="View these products">
                    <strong>{{ c.categoryName }}</strong>
                    <span class="muted">{{ c.productCount }} products · {{ c.totalUnits }} units</span>
                  </a>
                  <div class="subs">
                    @for (sub of namedSubs(c.subCategories); track sub.subCategoryName) {
                      <a class="sub-chip" [routerLink]="['/products']"
                         [queryParams]="subParams(i.id, c.categoryId, sub.subCategoryId)" title="View these products">
                        {{ sub.subCategoryName }} · {{ sub.productCount }}<span class="u"> ({{ sub.totalUnits }} u)</span>
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="muted no-stock">No products assigned to this inventory yet.</div>
          }
        </div>
      }
      @if (!loading() && rows().length === 0) { <div class="card empty-state">No inventories yet.</div> }
    </div>

    <mat-menu #labelMenu="matMenu">
      <ng-template matMenuContent let-inv="inv">
        <button mat-menu-item (click)="printLabels(inv, false)">
          <mat-icon>label</mat-icon><span>One label per product</span>
        </button>
        <button mat-menu-item (click)="printLabels(inv, true)">
          <mat-icon>inventory_2</mat-icon><span>One per unit in stock</span>
        </button>
      </ng-template>
    </mat-menu>
  `,
  styles: [`
    .intro { margin: -8px 0 16px; }
    .inv-card { margin-bottom: 16px; }
    .inv-head { display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap; }
    .inv-title { flex: 1 1 220px; }
    .inv-title strong { font-size: 18px; }
    .paid-by { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; vertical-align: middle;
      background: var(--lv-rose-soft); color: var(--lv-wine); border-radius: 999px; padding: 2px 10px 2px 8px;
      font-size: 12px; font-weight: 600; }
    .paid-by mat-icon { font-size: 15px; height: 15px; width: 15px; }
    .inv-stats { display: flex; gap: 20px; }
    .stat { display: flex; flex-direction: column; align-items: center; }
    .stat .v { font-size: 22px; font-weight: 700; color: var(--lv-wine); line-height: 1.1; }
    .stat .l { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: rgba(58,37,48,.55); }
    .stat.cost .inr { font-size: 11px; color: rgba(58,37,48,.55); margin-top: 1px; }
    .inv-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .store-toggle .st-label { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
    .store-toggle mat-icon { font-size: 16px; height: 16px; width: 16px; }
    .off-store { display: inline-flex; align-items: center; gap: 3px; background: #efe4e8; color: #7a5563;
      border: 1px solid #d9c3cc; }
    .off-store mat-icon { font-size: 14px; height: 14px; width: 14px; }
    .breakdown { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--lv-line);
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
    .cat-block { border: 1px solid var(--lv-line); border-radius: 10px; padding: 12px; background: #fffdfb; }
    .cat-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px;
      text-decoration: none; color: inherit; border-radius: 6px; padding: 2px 4px; margin: -2px -4px 6px; transition: background .12s; }
    .cat-head:hover { background: var(--lv-rose-soft); }
    .cat-head strong { color: var(--lv-wine); }
    .subs { display: flex; flex-wrap: wrap; gap: 6px; }
    .sub-chip { background: var(--lv-rose-soft); color: var(--lv-wine); border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 600;
      text-decoration: none; cursor: pointer; transition: background .12s, box-shadow .12s; }
    .sub-chip:hover { background: #ecd4de; box-shadow: 0 1px 4px rgba(110,31,62,.15); }
    .sub-chip .u { font-weight: 400; opacity: .75; }
    .no-stock { margin-top: 12px; }
    .perf { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;
      margin-top: 14px; padding: 12px 14px; border: 1px solid var(--lv-line); border-radius: 10px; background: #fffdfb; }
    .pcell { display: flex; flex-direction: column; gap: 1px; }
    .pcell .pl { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: rgba(58,37,48,.55); }
    .pcell .pv { font-size: 19px; font-weight: 700; color: var(--lv-wine); line-height: 1.15; }
    .pcell .pv.pos { color: #2e7d32; }
    .pcell .pv.neg { color: #b3261e; }
    .pcell .pinr { font-size: 11px; color: rgba(58,37,48,.55); }
  `]
})
export class InventoryListComponent {
  private api = inject(InventoryApi);
  private products = inject(ProductApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  rows = signal<Inventory[]>([]);
  loading = signal(false);
  printingId = signal<number | null>(null);
  togglingId = signal<number | null>(null);
  includeInactive = false;

  constructor() { this.load(); }

  /** Format a signed USD amount (e.g. "$459" or "−$120"). */
  signed(v: number): string {
    const s = Math.abs(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    return v < 0 ? '−' + s : s;
  }

  /** Only real subcategories — the "Unassigned" (null) bucket is not shown as a chip. */
  namedSubs(subs: SubCategoryCount[]): SubCategoryCount[] {
    return subs.filter(s => s.subCategoryId != null);
  }

  /** Build the /products query params, including subcategory only when it's a real one. */
  subParams(inventoryId: number, categoryId: number, subCategoryId: number | null | undefined) {
    return subCategoryId != null
      ? { inventoryId, categoryId, subCategoryId }
      : { inventoryId, categoryId };
  }

  load() {
    this.loading.set(true);
    this.api.list(this.includeInactive).subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  /** Fetch every product in this inventory batch and open a print-ready label sheet. */
  printLabels(i: Inventory, byStock: boolean) {
    this.printingId.set(i.id);
    this.products.list({ inventoryId: i.id, pageSize: 1000 }).subscribe({
      next: (r) => {
        this.printingId.set(null);
        const n = printProductLabels(r.items, byStock);
        if (n === 0) this.notify.error(`No ${byStock ? 'units in stock' : 'products'} to label in "${i.name}".`);
      },
      error: (e) => { this.printingId.set(null); this.notify.error(e); }
    });
  }

  /** Quick storefront on/off from the card — persists immediately via the inventory update. */
  toggleStore(i: Inventory, visible: boolean) {
    this.togglingId.set(i.id);
    this.api.update(i.id, {
      name: i.name, description: i.description ?? null, isActive: i.isActive,
      paidByOwnerId: i.paidByOwnerId ?? null, isVisibleOnStore: visible
    }).subscribe({
      next: () => {
        this.togglingId.set(null);
        this.rows.update(list => list.map(r => r.id === i.id ? { ...r, isVisibleOnStore: visible } : r));
        this.notify.success(visible ? `"${i.name}" is now shown on the storefront` : `"${i.name}" is hidden from the storefront`);
      },
      error: (e) => { this.togglingId.set(null); this.notify.error(e); }
    });
  }

  openEdit(i: Inventory | null) {
    this.dialog.open(InventoryEditDialog, { data: i }).afterClosed()
      .subscribe(ok => { if (ok) this.load(); });
  }

  remove(i: Inventory) {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete inventory', message: `Delete "${i.name}"? Its products are kept but unassigned.`, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(i.id).subscribe({
        next: () => { this.notify.success('Inventory deleted'); this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}