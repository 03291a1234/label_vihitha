import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { OwnerApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Owner } from '../../core/models';
import { OwnerEditDialog } from './owner-edit.dialog';
import { OwnerTransactionsDialog } from './owner-transactions.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';

@Component({
  selector: 'app-owner-list',
  standalone: true,
  imports: [
    CurrencyPipe, DecimalPipe, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatSlideToggleModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Owners</h1>
        <div class="toolbar-row">
          <mat-slide-toggle [(ngModel)]="includeInactive" (change)="load()">Show inactive</mat-slide-toggle>
          <button mat-raised-button color="primary" (click)="openEdit(null)"><mat-icon>add</mat-icon> New owner</button>
        </div>
      </div>

      @if (shareWarning(); as w) { <div class="warn-banner"><mat-icon>info</mat-icon> {{ w }}</div> }
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Owner</th>
            <td mat-cell *matCellDef="let o">
              <strong>{{ o.name }}</strong>
              @if (!o.isActive) { <span class="chip Cancelled">inactive</span> }
              @if (o.email || o.phone) { <div class="muted">{{ o.email || o.phone }}</div> }
            </td>
          </ng-container>
          <ng-container matColumnDef="share">
            <th mat-header-cell *matHeaderCellDef class="text-right">Profit share</th>
            <td mat-cell *matCellDef="let o" class="text-right mono">{{ o.profitSharePercent | number:'1.0-2' }}%</td>
          </ng-container>
          <ng-container matColumnDef="contributions">
            <th mat-header-cell *matHeaderCellDef class="text-right">Contributions</th>
            <td mat-cell *matCellDef="let o" class="text-right mono">{{ o.totalContributions | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="withdrawals">
            <th mat-header-cell *matHeaderCellDef class="text-right">Withdrawals</th>
            <td mat-cell *matCellDef="let o" class="text-right mono">{{ o.totalWithdrawals | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="ledger">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let o">
              <button mat-stroked-button (click)="ledger(o)"><mat-icon>account_balance_wallet</mat-icon> Capital</button>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let o" class="text-right">
              <button mat-icon-button (click)="openEdit(o)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button color="warn" (click)="remove(o)"><mat-icon>delete</mat-icon></button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">No owners yet. Add the business partners to split profit.</div> }
      </div>
    </div>
  `,
  styles: [`
    .warn-banner { display: flex; align-items: center; gap: 8px; background: #fff6e6; color: #8a5a00;
      border: 1px solid #f0d9a8; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; font-size: 14px; }
    .warn-banner mat-icon { font-size: 18px; height: 18px; width: 18px; }
  `]
})
export class OwnerListComponent {
  private api = inject(OwnerApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);

  rows = signal<Owner[]>([]);
  loading = signal(false);
  includeInactive = false;
  cols = ['name', 'share', 'contributions', 'withdrawals', 'ledger', 'actions'];

  totalShare = computed(() => this.rows().filter(o => o.isActive).reduce((s, o) => s + o.profitSharePercent, 0));
  shareWarning = computed(() => {
    const t = this.totalShare();
    if (this.rows().length === 0) return null;
    return Math.abs(t - 100) < 0.01 ? null : `Profit shares add up to ${t}% — they should total 100% for a complete split.`;
  });

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.list(this.includeInactive).subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  openEdit(o: Owner | null) {
    this.dialog.open(OwnerEditDialog, { data: o, width: '520px' }).afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  ledger(o: Owner) {
    this.dialog.open(OwnerTransactionsDialog, { data: o, width: '520px' })
      .afterClosed().subscribe(changed => { if (changed) this.load(); });
  }

  remove(o: Owner) {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete owner', message: `Deactivate "${o.name}"?`, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(o.id).subscribe({
        next: () => { this.notify.success('Owner deleted'); this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}
