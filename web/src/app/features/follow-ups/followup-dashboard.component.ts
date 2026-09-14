import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { FollowUpApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { FollowUp, FollowUpStatus } from '../../core/models';
import { sortRows } from '../../shared/sort';

@Component({
  selector: 'app-followup-dashboard',
  standalone: true,
  imports: [
    DatePipe, FormsModule, RouterLink, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatSelectModule, MatSlideToggleModule, MatProgressBarModule, MatSortModule
  ],
  template: `
    <div class="page">
      <div class="page-header"><h1>Follow-ups</h1></div>

      <div class="toolbar-row">
        <mat-form-field>
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="status" (selectionChange)="reload()">
            <mat-option [value]="null">Open (unresolved)</mat-option>
            @for (s of statuses; track s) { <mat-option [value]="s">{{ s }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-slide-toggle [(ngModel)]="overdueOnly" (change)="reload()">Overdue only</mat-slide-toggle>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full" matSort (matSortChange)="onSort($event)">
          <ng-container matColumnDef="note">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Follow-up</th>
            <td mat-cell *matCellDef="let f">
              <strong>{{ f.note }}</strong>
              <div class="muted">{{ f.productName ? f.productName : 'Whole order' }} · by {{ f.createdBy || '—' }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="orderNumber">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Order</th>
            <td mat-cell *matCellDef="let f" class="mono">
              <a [routerLink]="['/orders', f.orderId]">{{ f.orderNumber }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="followUpDate">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Due</th>
            <td mat-cell *matCellDef="let f">
              @if (f.followUpDate) {
                <span [class.overdue]="f.isOverdue">{{ f.followUpDate | date:'mediumDate' }}</span>
              } @else { <span class="muted">—</span> }
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
            <td mat-cell *matCellDef="let f">
              <span class="chip {{f.status}}">{{ f.status }}</span>
              @if (f.isOverdue) { <span class="overdue"> OVERDUE</span> }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let f" class="text-right">
              @if (auth.canManageSales() && f.status !== 'Resolved') {
                @if (f.status === 'Open') {
                  <button mat-button (click)="setStatus(f, 'InProgress')">Start</button>
                }
                <button mat-button color="primary" (click)="setStatus(f, 'Resolved')">Resolve</button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">Nothing outstanding. 🎉</div> }
      </div>
    </div>
  `
})
export class FollowUpDashboardComponent {
  private api = inject(FollowUpApi);
  private notify = inject(Notify);
  auth = inject(AuthService);

  rows = signal<FollowUp[]>([]);
  loading = signal(false);
  status: FollowUpStatus | null = null;
  overdueOnly = false;
  statuses: FollowUpStatus[] = ['Open', 'InProgress', 'Resolved'];
  cols = ['note', 'orderNumber', 'followUpDate', 'status', 'actions'];

  private data: FollowUp[] = [];
  private sort: Sort = { active: '', direction: '' };

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.dashboard({
      status: this.status,
      overdueOnly: this.overdueOnly,
      openOnly: this.status === null,
      pageSize: 100
    }).subscribe({
      next: (r) => { this.data = r.items; this.applyView(); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  onSort(s: Sort) { this.sort = s; this.applyView(); }
  private applyView() { this.rows.set(sortRows(this.data, this.sort)); }

  reload() { this.load(); }

  setStatus(f: FollowUp, status: FollowUpStatus) {
    this.api.update(f.id, { status, resolutionNote: status === 'Resolved' ? 'Resolved' : null }).subscribe({
      next: () => { this.notify.success(`Marked ${status}`); this.load(); },
      error: (e) => this.notify.error(e)
    });
  }
}
