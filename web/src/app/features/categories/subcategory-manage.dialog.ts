import { Component, Inject, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { SubCategoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { SubCategory } from '../../core/models';
import { ConfirmDialog } from '../../shared/confirm.dialog';

export interface SubCategoryManageData { categoryId: number; categoryName: string; }

@Component({
  selector: 'app-subcategory-manage',
  standalone: true,
  imports: [
    FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatListModule
  ],
  template: `
    <h2 mat-dialog-title>Subcategories · {{ data.categoryName }}</h2>
    <mat-dialog-content>
      <div class="add-row">
        <mat-form-field class="grow">
          <mat-label>New subcategory</mat-label>
          <input matInput [(ngModel)]="newName" (keyup.enter)="add()" placeholder="e.g. Banarasi" />
        </mat-form-field>
        <button mat-raised-button color="primary" (click)="add()" [disabled]="!newName.trim() || busy()">
          <mat-icon>add</mat-icon> Add
        </button>
      </div>

      @if (rows().length === 0) { <div class="muted empty">No subcategories yet.</div> }

      <div class="rows">
        @for (s of rows(); track s.id) {
          <div class="srow">
            @if (editingId() === s.id) {
              <div class="edit">
                <mat-form-field class="grow">
                  <mat-label>Name</mat-label>
                  <input matInput [(ngModel)]="editName" />
                </mat-form-field>
                <mat-form-field class="grow">
                  <mat-label>Sizes (comma-separated)</mat-label>
                  <input matInput [(ngModel)]="editSizes" placeholder="e.g. 2.4, 2.6, 2.8" />
                  <mat-hint>Offered as the Size options on products</mat-hint>
                </mat-form-field>
                <div class="edit-actions">
                  <button mat-icon-button color="primary" (click)="saveEdit(s)"><mat-icon>check</mat-icon></button>
                  <button mat-icon-button (click)="editingId.set(null)"><mat-icon>close</mat-icon></button>
                </div>
              </div>
            } @else {
              <div class="view">
                <div class="info">
                  <strong>{{ s.name }}</strong>
                  <span class="muted count">{{ s.productCount }} product{{ s.productCount === 1 ? '' : 's' }}</span>
                  @if (s.sizes.length) {
                    <div class="sizes">
                      <span class="muted">Sizes:</span>
                      @for (z of s.sizes; track z) { <span class="size-chip">{{ z }}</span> }
                    </div>
                  }
                </div>
                <div class="row-actions">
                  <button mat-icon-button (click)="startEdit(s)" title="Edit name & sizes"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="remove(s)" title="Delete subcategory"><mat-icon>delete</mat-icon></button>
                </div>
              </div>
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
    .rows { display: flex; flex-direction: column; }
    .srow { border-bottom: 1px solid #f0f0f0; padding: 8px 0; }
    .view { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .info { display: flex; flex-direction: column; gap: 2px; }
    .count { font-size: 12px; }
    .sizes { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 4px; font-size: 12px; }
    .size-chip { background: var(--lv-rose-soft); color: var(--lv-wine); border-radius: 999px; padding: 2px 9px; font-weight: 600; }
    .edit { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
    .edit-actions, .row-actions { display: flex; align-items: center; }
  `]
})
export class SubCategoryManageDialog {
  private api = inject(SubCategoryApi);
  private notify = inject(Notify);
  private dialog = inject(MatDialog);
  ref = inject(MatDialogRef<SubCategoryManageDialog>);

  rows = signal<SubCategory[]>([]);
  busy = signal(false);
  editingId = signal<number | null>(null);
  newName = '';
  editName = '';
  editSizes = '';
  changed = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: SubCategoryManageData) {
    this.load();
  }

  load() {
    this.api.list(this.data.categoryId, true).subscribe(s => this.rows.set(s));
  }

  add() {
    const name = this.newName.trim();
    if (!name) return;
    this.busy.set(true);
    this.api.create({ categoryId: this.data.categoryId, name }).subscribe({
      next: () => { this.newName = ''; this.busy.set(false); this.changed = true; this.notify.success('Subcategory added'); this.load(); },
      error: (e) => { this.busy.set(false); this.notify.error(e); }
    });
  }

  startEdit(s: SubCategory) {
    this.editingId.set(s.id);
    this.editName = s.name;
    this.editSizes = s.sizes.join(', ');
  }

  saveEdit(s: SubCategory) {
    const name = this.editName.trim();
    if (!name) return;
    const sizes = this.editSizes.split(',').map(x => x.trim()).filter(x => x.length > 0);
    this.api.update(s.id, { name, description: s.description ?? null, isActive: s.isActive, sizes }).subscribe({
      next: () => { this.editingId.set(null); this.changed = true; this.notify.success('Saved'); this.load(); },
      error: (e) => this.notify.error(e)
    });
  }

  remove(s: SubCategory) {
    const msg = s.productCount > 0
      ? `Delete "${s.name}"? Its ${s.productCount} product${s.productCount === 1 ? '' : 's'} will be kept but unassigned from this subcategory.`
      : `Delete "${s.name}"?`;
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete subcategory', message: msg, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(s.id).subscribe({
        next: () => { this.changed = true; this.notify.success('Subcategory deleted'); this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}
