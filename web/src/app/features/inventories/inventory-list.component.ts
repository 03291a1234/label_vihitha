import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { InventoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { Inventory } from '../../core/models';
import { InventoryEditDialog } from './inventory-edit.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [
    FormsModule, RouterLink, MatButtonModule, MatIconModule,
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

      <p class="muted intro">Group your stock into named collections (Inventory 1…n) — a batch of sarees or dresses.</p>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      @for (i of rows(); track i.id) {
        <div class="card inv-card">
          <div class="inv-head">
            <div class="inv-title">
              <strong>{{ i.name }}</strong>
              @if (!i.isActive) { <span class="chip Cancelled">inactive</span> }
              <div class="muted">{{ i.description }}</div>
            </div>
            <div class="inv-stats">
              <div class="stat"><span class="v">{{ i.productCount }}</span><span class="l">products</span></div>
              <div class="stat"><span class="v">{{ i.totalUnits }}</span><span class="l">units</span></div>
            </div>
            <div class="inv-actions">
              <button mat-stroked-button [routerLink]="['/products']" [queryParams]="{ inventoryId: i.id }">
                <mat-icon>inventory_2</mat-icon> View products
              </button>
              @if (auth.canManageInventory()) {
                <button mat-icon-button (click)="openEdit(i)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="remove(i)"><mat-icon>delete</mat-icon></button>
              }
            </div>
          </div>

          @if (i.categories.length > 0) {
            <div class="breakdown">
              @for (c of i.categories; track c.categoryId) {
                <div class="cat-block">
                  <div class="cat-head">
                    <strong>{{ c.categoryName }}</strong>
                    <span class="muted">{{ c.productCount }} products · {{ c.totalUnits }} units</span>
                  </div>
                  <div class="subs">
                    @for (sub of c.subCategories; track sub.subCategoryName) {
                      <span class="sub-chip">{{ sub.subCategoryName }} · {{ sub.productCount }}<span class="u"> ({{ sub.totalUnits }} u)</span></span>
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
  `,
  styles: [`
    .intro { margin: -8px 0 16px; }
    .inv-card { margin-bottom: 16px; }
    .inv-head { display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap; }
    .inv-title { flex: 1 1 220px; }
    .inv-title strong { font-size: 18px; }
    .inv-stats { display: flex; gap: 20px; }
    .stat { display: flex; flex-direction: column; align-items: center; }
    .stat .v { font-family: "Cormorant Garamond", Georgia, serif; font-size: 26px; font-weight: 700; color: var(--lv-wine); line-height: 1; }
    .stat .l { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: rgba(58,37,48,.55); }
    .inv-actions { display: flex; align-items: center; gap: 4px; }
    .breakdown { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--lv-line);
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
    .cat-block { border: 1px solid var(--lv-line); border-radius: 10px; padding: 12px; background: #fffdfb; }
    .cat-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .subs { display: flex; flex-wrap: wrap; gap: 6px; }
    .sub-chip { background: var(--lv-rose-soft); color: var(--lv-wine); border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 600; }
    .sub-chip .u { font-weight: 400; opacity: .75; }
    .no-stock { margin-top: 12px; }
  `]
})
export class InventoryListComponent {
  private api = inject(InventoryApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  rows = signal<Inventory[]>([]);
  loading = signal(false);
  includeInactive = false;

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.list(this.includeInactive).subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  openEdit(i: Inventory | null) {
    this.dialog.open(InventoryEditDialog, { data: i, width: '420px' }).afterClosed()
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
