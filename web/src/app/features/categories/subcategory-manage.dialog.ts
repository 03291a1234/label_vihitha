import { Component, Inject, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { SubCategoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { SubCategory } from '../../core/models';

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

      @if (rows().length === 0) {
        <div class="muted empty">No subcategories yet.</div>
      }
      <mat-list>
        @for (s of rows(); track s.id) {
          <mat-list-item>
            @if (editingId() === s.id) {
              <input class="edit-input" [(ngModel)]="editName" (keyup.enter)="saveEdit(s)" />
              <button mat-icon-button color="primary" (click)="saveEdit(s)"><mat-icon>check</mat-icon></button>
              <button mat-icon-button (click)="editingId.set(null)"><mat-icon>close</mat-icon></button>
            } @else {
              <span matListItemTitle>{{ s.name }}</span>
              <span matListItemMeta class="muted">{{ s.productCount }} product{{ s.productCount === 1 ? '' : 's' }}</span>
              <button mat-icon-button (click)="startEdit(s)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button color="warn" (click)="remove(s)"><mat-icon>delete</mat-icon></button>
            }
          </mat-list-item>
        }
      </mat-list>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(changed)">Done</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .add-row { display: flex; gap: 8px; align-items: flex-start; }
    .grow { flex: 1; }
    .empty { padding: 16px 4px; }
    .edit-input { flex: 1; font: inherit; padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px; }
    mat-list-item span[matListItemMeta] { margin-right: 12px; font-size: 12px; }
  `]
})
export class SubCategoryManageDialog {
  private api = inject(SubCategoryApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<SubCategoryManageDialog>);

  rows = signal<SubCategory[]>([]);
  busy = signal(false);
  editingId = signal<number | null>(null);
  newName = '';
  editName = '';
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

  startEdit(s: SubCategory) { this.editingId.set(s.id); this.editName = s.name; }

  saveEdit(s: SubCategory) {
    const name = this.editName.trim();
    if (!name) return;
    this.api.update(s.id, { name, description: s.description ?? null, isActive: s.isActive }).subscribe({
      next: () => { this.editingId.set(null); this.changed = true; this.notify.success('Renamed'); this.load(); },
      error: (e) => this.notify.error(e)
    });
  }

  remove(s: SubCategory) {
    this.api.remove(s.id).subscribe({
      next: () => { this.changed = true; this.notify.success('Subcategory removed'); this.load(); },
      error: (e) => this.notify.error(e)
    });
  }
}
