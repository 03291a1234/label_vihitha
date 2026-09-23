import { Component, inject, signal } from '@angular/core';
import { MoneyPipe } from '../../shared/money.pipe';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PromoCodeApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { PromoCode } from '../../core/models';
import { PromoCodeEditDialog } from './promo-code-edit.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';

@Component({
  selector: 'app-promo-code-list',
  standalone: true,
  imports: [
    MoneyPipe, DatePipe, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatSlideToggleModule, MatProgressBarModule, MatDialogModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Promo codes</h1>
        <div class="toolbar-row">
          <mat-slide-toggle [(ngModel)]="includeInactive" (change)="load()">Show inactive</mat-slide-toggle>
          <button mat-raised-button color="primary" (click)="openEdit(null)"><mat-icon>add</mat-icon> New promo code</button>
        </div>
      </div>
      <p class="muted intro">Discount codes customers enter at checkout — great for festival or special-day offers.</p>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full">
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef>Code</th>
            <td mat-cell *matCellDef="let p"><strong>{{ p.code }}</strong>
              @if (!p.isActive) { <span class="chip Cancelled">inactive</span> }
              <div class="muted">{{ p.description }}</div></td>
          </ng-container>
          <ng-container matColumnDef="discount">
            <th mat-header-cell *matHeaderCellDef>Discount</th>
            <td mat-cell *matCellDef="let p">
              @if (p.discountType === 'Percentage') { <strong>{{ p.value }}%</strong> off }
              @else { <strong>{{ p.value | currency }}</strong> off }
              @if (p.minOrderAmount) { <div class="muted">min {{ p.minOrderAmount | currency }}</div> }
            </td>
          </ng-container>
          <ng-container matColumnDef="validity">
            <th mat-header-cell *matHeaderCellDef>Validity</th>
            <td mat-cell *matCellDef="let p">
              @if (p.validFrom || p.validTo) {
                {{ p.validFrom ? (p.validFrom | date:'mediumDate') : '—' }} → {{ p.validTo ? (p.validTo | date:'mediumDate') : '—' }}
              } @else { <span class="muted">Always</span> }
              <div class="muted" [class.expired]="isExpired(p)">{{ statusText(p) }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="usage">
            <th mat-header-cell *matHeaderCellDef class="text-right">Used</th>
            <td mat-cell *matCellDef="let p" class="text-right mono">{{ p.timesUsed }}@if (p.maxUses) { / {{ p.maxUses }} }</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let p" class="text-right">
              <button mat-icon-button (click)="openEdit(p)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button color="warn" (click)="remove(p)"><mat-icon>delete</mat-icon></button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">No promo codes yet — create one for your next special day.</div> }
      </div>
    </div>
  `,
  styles: [`
    .intro { margin: -8px 0 16px; }
    .expired { color: #b3261e; }
  `]
})
export class PromoCodeListComponent {
  private api = inject(PromoCodeApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);

  rows = signal<PromoCode[]>([]);
  loading = signal(false);
  includeInactive = false;
  cols = ['code', 'discount', 'validity', 'usage', 'actions'];

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.list(this.includeInactive).subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  isExpired(p: PromoCode): boolean {
    return !!(p.validTo && new Date(p.validTo) < new Date());
  }
  statusText(p: PromoCode): string {
    const now = new Date();
    if (p.validFrom && new Date(p.validFrom) > now) return 'Starts later';
    if (p.validTo && new Date(p.validTo) < now) return 'Expired';
    if (p.maxUses && p.timesUsed >= p.maxUses) return 'Usage limit reached';
    return p.isActive ? 'Live' : 'Inactive';
  }

  openEdit(p: PromoCode | null) {
    this.dialog.open(PromoCodeEditDialog, { data: p, width: '560px' })
      .afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  remove(p: PromoCode) {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete promo code', message: `Delete "${p.code}"?`, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(p.id).subscribe({
        next: () => { this.notify.success('Promo code deleted'); this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}
