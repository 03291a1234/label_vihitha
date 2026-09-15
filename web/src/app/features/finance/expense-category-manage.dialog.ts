import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ExpenseCategoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { ExpenseCategory } from '../../core/models';
import { ConfirmDialog } from '../../shared/confirm.dialog';

@Component({
  selector: 'app-expense-category-manage',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Expense categories</h2>
    <mat-dialog-content>
      <div class="add-row">
        <mat-form-field class="grow">
          <mat-label>New category</mat-label>
          <input matInput [(ngModel)]="newName" (keyup.enter)="add()" placeholder="e.g. Rent" />
        </mat-form-field>
        <button mat-raised-button color="primary" (click)="add()" [disabled]="!newName.trim() || busy()">
          <mat-icon>add</mat-icon> Add
        </button>
      </div>
      @if (rows().length === 0) { <div class="muted empty">No categories yet.</div> }
      <div class="rows">
        @for (c of rows(); track c.id) {
          <div class="srow">
            @if (editingId() === c.id) {
              <mat-form-field class="grow">
                <mat-label>Name</mat-label>
                <input matInput [(ngModel)]="editName" />
              </mat-form-field>
              <button mat-icon-button color="primary" (click)="saveEdit(c)"><mat-icon>check</mat-icon></button>
              <button mat-icon-button (click)="editingId.set(null)"><mat-icon>close</mat-icon></button>
            } @else {
              <div class="info"><strong>{{ c.name }}</strong>
                <span class="muted">{{ c.expenseCount }} expense{{ c.expenseCount === 1 ? '' : 's' }}</span></div>
              <button mat-icon-button (click)="startEdit(c)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button color="warn" (click)="remove(c)"><mat-icon>delete</mat-icon></button>
            }
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(changed)">Done</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .add-row { display: flex; gap: 8px; align-items: flex-start; }
    .grow { flex: 1; }
    .empty { padding: 16px 4px; }
    .srow { display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #f0f0f0; padding: 6px 0; }
    .info { flex: 1; display: flex; flex-direction: column; }
    .info .muted { font-size: 12px; }
  `]
})
export class ExpenseCategoryManageDialog {
  private api = inject(ExpenseCategoryApi);
  private notify = inject(Notify);
  private dialog = inject(MatDialog);
  ref = inject(MatDialogRef<ExpenseCategoryManageDialog>);

  rows = signal<ExpenseCategory[]>([]);
  busy = signal(false);
  editingId = signal<number | null>(null);
  newName = '';
  editName = '';
  changed = false;

  constructor() { this.load(); }
  load() { this.api.list(true).subscribe(c => this.rows.set(c)); }

  add() {
    const name = this.newName.trim();
    if (!name) return;
    this.busy.set(true);
    this.api.create({ name }).subscribe({
      next: () => { this.newName = ''; this.busy.set(false); this.changed = true; this.notify.success('Category added'); this.load(); },
      error: (e) => { this.busy.set(false); this.notify.error(e); }
    });
  }

  startEdit(c: ExpenseCategory) { this.editingId.set(c.id); this.editName = c.name; }

  saveEdit(c: ExpenseCategory) {
    const name = this.editName.trim();
    if (!name) return;
    this.api.update(c.id, { name, description: c.description ?? null, isActive: c.isActive }).subscribe({
      next: () => { this.editingId.set(null); this.changed = true; this.notify.success('Saved'); this.load(); },
      error: (e) => this.notify.error(e)
    });
  }

  remove(c: ExpenseCategory) {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete category', message: `Delete "${c.name}"?`, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(c.id).subscribe({
        next: () => { this.changed = true; this.notify.success('Category deleted'); this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}
