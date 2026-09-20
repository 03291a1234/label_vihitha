import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CategoryApi, ProductApi, apiOrigin } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Category } from '../../core/models';

@Component({
  selector: 'app-category-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSlideToggleModule, MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit category' : 'New category' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field>
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description"></textarea>
        </mat-form-field>

        <div class="cover">
          <span class="cover-label">Collection cover <span class="muted">(shown on the shop landing)</span></span>
          <div class="cover-row">
            <div class="thumb" [class.empty]="!imageUrl()">
              @if (imageUrl()) { <img [src]="preview(imageUrl())" alt="cover" /> }
              @else { <mat-icon>image</mat-icon> }
            </div>
            <div class="cover-actions">
              <button type="button" mat-stroked-button (click)="file.click()" [disabled]="uploading()">
                @if (uploading()) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>upload</mat-icon> }
                {{ imageUrl() ? 'Replace' : 'Upload image' }}
              </button>
              @if (imageUrl()) {
                <button type="button" mat-button color="warn" (click)="imageUrl.set(null)">Remove</button>
              }
              <input #file type="file" hidden accept="image/*" (change)="onFile($event)" />
            </div>
          </div>
        </div>

        @if (data) {
          <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving() || uploading()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .cover { margin: 6px 0 4px; }
    .cover-label { font-size: 13px; color: var(--lv-wine); font-weight: 600; }
    .muted { color: rgba(58,37,48,.55); font-weight: 400; }
    .cover-row { display: flex; align-items: center; gap: 14px; margin-top: 8px; }
    .thumb { width: 96px; height: 72px; border-radius: 10px; overflow: hidden; flex: 0 0 auto;
      background: var(--lv-cream-2); display: grid; place-items: center; border: 1px solid var(--lv-line); }
    .thumb.empty mat-icon { color: #c9a24b; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .cover-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  `]
})
export class CategoryEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(CategoryApi);
  private products = inject(ProductApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<CategoryEditDialog>);
  saving = signal(false);
  uploading = signal(false);
  imageUrl = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    isActive: [true]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Category | null) {
    if (data) {
      this.form.patchValue({ name: data.name, description: data.description ?? '', isActive: data.isActive });
      this.imageUrl.set(data.imageUrl ?? null);
    }
  }

  preview(url: string | null) { return !url ? '' : url.startsWith('http') ? url : apiOrigin + url; }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.products.uploadImage(file).subscribe({
      next: (r) => { this.imageUrl.set(r.url); this.uploading.set(false); },
      error: (e) => { this.uploading.set(false); this.notify.error(e); }
    });
    input.value = '';
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body = { name: v.name, description: v.description || null, isActive: v.isActive, imageUrl: this.imageUrl() };
    const req = this.data ? this.api.update(this.data.id, body) : this.api.create(body);
    req.subscribe({
      next: () => { this.notify.success('Category saved'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
