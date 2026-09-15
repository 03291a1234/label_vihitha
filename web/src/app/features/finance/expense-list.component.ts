import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { ExpenseApi, ExpenseCategoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Expense, ExpenseCategory } from '../../core/models';
import { ExpenseEditDialog } from './expense-edit.dialog';
import { ExpenseCategoryManageDialog } from './expense-category-manage.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';

@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [
    CurrencyPipe, DatePipe, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressBarModule, MatPaginatorModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Expenses</h1>
        <div class="toolbar-row">
          <button mat-stroked-button (click)="manageCategories()"><mat-icon>category</mat-icon> Categories</button>
          <button mat-raised-button color="primary" (click)="openEdit(null)"><mat-icon>add</mat-icon> New expense</button>
        </div>
      </div>

      <div class="toolbar-row">
        <mat-form-field>
          <mat-label>Category</mat-label>
          <mat-select [(ngModel)]="categoryId" (selectionChange)="reload()">
            <mat-option [value]="null">All</mat-option>
            @for (c of categories(); track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>From</mat-label>
          <input matInput type="date" [(ngModel)]="fromDate" (change)="reload()" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>To</mat-label>
          <input matInput type="date" [(ngModel)]="toDate" (change)="reload()" />
        </mat-form-field>
        <div class="total-chip">Total: <strong>{{ pageTotal() | currency }}</strong>
          <span class="muted">≈ {{ pageTotal() * inrRate | currency:'INR':'symbol':'1.0-0' }}</span></div>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full">
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let e">{{ e.date | date:'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef>Category</th>
            <td mat-cell *matCellDef="let e"><strong>{{ e.expenseCategoryName }}</strong></td>
          </ng-container>
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let e">{{ e.description || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="amountInr">
            <th mat-header-cell *matHeaderCellDef class="text-right">Amount (INR)</th>
            <td mat-cell *matCellDef="let e" class="text-right mono">{{ e.amount * inrRate | currency:'INR':'symbol':'1.0-0' }}</td>
          </ng-container>
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef class="text-right">Amount (USD)</th>
            <td mat-cell *matCellDef="let e" class="text-right mono">{{ e.amount | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let e" class="text-right">
              <button mat-icon-button (click)="openEdit(e)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button color="warn" (click)="remove(e)"><mat-icon>delete</mat-icon></button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">No expenses recorded.</div> }
        <mat-paginator [length]="total()" [pageSize]="pageSize" [pageIndex]="page - 1"
          [pageSizeOptions]="[10,25,50]" (page)="onPage($event)" />
      </div>
    </div>
  `,
  styles: [`
    .total-chip { margin-left: auto; align-self: center; color: var(--lv-wine); }
    .total-chip .muted { margin-left: 8px; font-size: 12px; }
  `]
})
export class ExpenseListComponent {
  private api = inject(ExpenseApi);
  private catApi = inject(ExpenseCategoryApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);

  readonly inrRate = 95;
  rows = signal<Expense[]>([]);
  categories = signal<ExpenseCategory[]>([]);
  total = signal(0);
  loading = signal(false);
  pageTotal = computed(() => this.rows().reduce((s, e) => s + e.amount, 0));

  categoryId: number | null = null;
  fromDate = '';
  toDate = '';
  page = 1;
  pageSize = 25;
  cols = ['date', 'category', 'description', 'amountInr', 'amount', 'actions'];

  constructor() {
    this.catApi.list(false).subscribe(c => this.categories.set(c));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.list({
      categoryId: this.categoryId,
      fromDate: this.fromDate ? new Date(this.fromDate).toISOString() : null,
      toDate: this.toDate ? new Date(this.toDate).toISOString() : null,
      page: this.page, pageSize: this.pageSize
    }).subscribe({
      next: (r) => { this.rows.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  reload() { this.page = 1; this.load(); }
  onPage(e: PageEvent) { this.page = e.pageIndex + 1; this.pageSize = e.pageSize; this.load(); }

  openEdit(e: Expense | null) {
    this.dialog.open(ExpenseEditDialog, { data: e, width: '520px' })
      .afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  manageCategories() {
    this.dialog.open(ExpenseCategoryManageDialog, { width: '460px' })
      .afterClosed().subscribe(changed => { if (changed) this.catApi.list(false).subscribe(c => this.categories.set(c)); });
  }

  remove(e: Expense) {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete expense', message: `Delete this ${e.expenseCategoryName} expense?`, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(e.id).subscribe({
        next: () => { this.notify.success('Expense deleted'); this.load(); },
        error: (err) => this.notify.error(err)
      });
    });
  }
}
