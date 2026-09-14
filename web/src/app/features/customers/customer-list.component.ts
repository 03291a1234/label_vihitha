import { Component, Inject, inject, signal } from '@angular/core';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CustomerApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { Customer } from '../../core/models';
import { ConfirmDialog } from '../../shared/confirm.dialog';

@Component({
  selector: 'app-customer-edit',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit customer' : 'New customer' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field><mat-label>Name</mat-label><input matInput formControlName="name" /></mat-form-field>
        <div class="form-row">
          <mat-form-field><mat-label>Phone</mat-label><input matInput formControlName="phone" /></mat-form-field>
          <mat-form-field><mat-label>Email</mat-label><input matInput formControlName="email" /></mat-form-field>
        </div>
        <mat-form-field><mat-label>Address</mat-label><input matInput formControlName="address" /></mat-form-field>
        <mat-form-field><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving()">Save</button>
    </mat-dialog-actions>
  `
})
export class CustomerEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(CustomerApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<CustomerEditDialog>);
  saving = signal(false);
  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    phone: [''], email: ['', Validators.email], address: [''], notes: ['']
  });
  constructor(@Inject(MAT_DIALOG_DATA) public data: Customer | null) {
    if (data) this.form.patchValue({
      name: data.name, phone: data.phone ?? '', email: data.email ?? '',
      address: data.address ?? '', notes: data.notes ?? ''
    });
  }
  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body = { name: v.name, phone: v.phone || null, email: v.email || null, address: v.address || null, notes: v.notes || null };
    const req = this.data ? this.api.update(this.data.id, body) : this.api.create(body);
    req.subscribe({
      next: () => { this.notify.success('Customer saved'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatProgressBarModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Customers</h1>
        @if (auth.canManage()) {
          <button mat-raised-button color="primary" (click)="openEdit(null)"><mat-icon>add</mat-icon> New customer</button>
        }
      </div>
      <div class="toolbar-row">
        <mat-form-field>
          <mat-label>Search</mat-label>
          <input matInput [(ngModel)]="search" (keyup.enter)="load()" placeholder="Name, phone or email" />
        </mat-form-field>
        <button mat-button (click)="load()"><mat-icon>search</mat-icon> Search</button>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let c"><strong>{{ c.name }}</strong></td>
          </ng-container>
          <ng-container matColumnDef="phone">
            <th mat-header-cell *matHeaderCellDef>Phone</th>
            <td mat-cell *matCellDef="let c">{{ c.phone }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let c">{{ c.email }}</td>
          </ng-container>
          <ng-container matColumnDef="orderCount">
            <th mat-header-cell *matHeaderCellDef class="text-right">Orders</th>
            <td mat-cell *matCellDef="let c" class="text-right mono">{{ c.orderCount }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let c" class="text-right">
              @if (auth.canManage()) {
                <button mat-icon-button (click)="openEdit(c)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="remove(c)"><mat-icon>delete</mat-icon></button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">No customers found.</div> }
      </div>
    </div>
  `
})
export class CustomerListComponent {
  private api = inject(CustomerApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  rows = signal<Customer[]>([]);
  loading = signal(false);
  search = '';
  cols = ['name', 'phone', 'email', 'orderCount', 'actions'];

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.list(this.search || undefined).subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  openEdit(c: Customer | null) {
    this.dialog.open(CustomerEditDialog, { data: c }).afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  remove(c: Customer) {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete customer', message: `Delete "${c.name}"? (Blocked if they have orders.)`, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(c.id).subscribe({
        next: () => { this.notify.success('Customer deleted'); this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}
