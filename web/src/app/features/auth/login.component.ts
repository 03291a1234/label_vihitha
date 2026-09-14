import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/auth/auth.service';
import { Notify } from '../../core/services/notify.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressBarModule
  ],
  template: `
    <div class="login-wrap">
      <mat-card class="login-card">
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <mat-card-content>
          <div class="logo">
            <mat-icon>storefront</mat-icon>
            <h1>Label_Vihitha</h1>
            <p class="muted">Order & Inventory Management</p>
          </div>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field class="full">
              <mat-label>Username</mat-label>
              <input matInput formControlName="userName" autocomplete="username" />
            </mat-form-field>
            <mat-form-field class="full">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="current-password" />
            </mat-form-field>
            <button mat-raised-button color="primary" class="full" type="submit" [disabled]="loading()">
              Sign in
            </button>
          </form>
          <p class="hint muted">Seeded owner: <code>owner</code> / <code>Owner#12345</code></p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px;
      background: linear-gradient(135deg, #1e1e2d, #3a3a5a); }
    .login-card { width: 360px; max-width: 100%; border-radius: 16px; overflow: hidden; }
    .logo { text-align: center; margin: 12px 0 20px; }
    .logo mat-icon { font-size: 44px; height: 44px; width: 44px; color: #5b5bd6; }
    .logo h1 { margin: 8px 0 0; font-size: 22px; }
    .full { width: 100%; }
    .hint { text-align: center; font-size: 12px; margin-top: 8px; }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(Notify);

  loading = signal(false);
  form = this.fb.nonNullable.group({
    userName: ['owner', Validators.required],
    password: ['Owner#12345', Validators.required]
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { userName, password } = this.form.getRawValue();
    this.auth.login(userName, password).subscribe({
      next: () => { this.loading.set(false); this.router.navigate(['/orders']); },
      error: (e) => { this.loading.set(false); this.notify.error(e, 'Login failed'); }
    });
  }
}
