import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
    ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressBarModule
  ],
  template: `
    <div class="login-wrap">
      <mat-card class="login-card">
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <mat-card-content>
          <div class="logo">
            <span class="emblem"><img src="logo.jpeg" alt="Vihitha" /></span>
            <h1>Vihitha</h1>
            <p class="tag">Every thread · every style · every story</p>
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
          <p class="hint muted">
            Admin <code>owner</code>/<code>Owner#12345</code> ·
            Owner <code>manager</code>/<code>Manager#12345</code> ·
            Inventory <code>stock</code>/<code>Stock#12345</code>
          </p>
          <div class="shop-link">
            <a routerLink="/shop"><mat-icon>storefront</mat-icon> Shop as a customer</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-wrap {
      min-height: 100vh; display: grid; place-items: center; padding: 16px;
      background:
        radial-gradient(1200px 600px at 50% -10%, rgba(201,154,62,.18), transparent 60%),
        linear-gradient(160deg, #6e1f3e 0%, #3f1228 100%);
    }
    .login-card {
      width: 372px; max-width: 100%; border-radius: 20px; overflow: hidden;
      background: #fffdfa; box-shadow: 0 24px 60px rgba(0,0,0,.35);
    }
    .logo { text-align: center; margin: 16px 0 22px; }
    .emblem {
      width: 108px; height: 108px; border-radius: 50%; margin: 0 auto;
      display: grid; place-items: center; overflow: hidden; background: #fbf5ea;
      border: 2px solid #c39a3e; box-shadow: 0 6px 18px rgba(110,31,62,.18);
    }
    .emblem img { width: 122%; height: 122%; object-fit: cover; }
    .logo h1 {
      font-family: "Cormorant Garamond", Georgia, serif; font-weight: 700;
      margin: 12px 0 0; font-size: 34px; color: #6e1f3e; letter-spacing: .5px;
    }
    .logo .tag {
      margin: 4px 0 0; font-size: 11px; letter-spacing: 1.4px; text-transform: uppercase;
      color: #c39a3e;
    }
    .full { width: 100%; }
    .hint { text-align: center; font-size: 11px; margin-top: 10px; line-height: 1.6; }
    .shop-link { text-align: center; margin-top: 14px; padding-top: 12px; border-top: 1px solid #eee; }
    .shop-link a { color: #6e1f3e; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .shop-link mat-icon { font-size: 18px; height: 18px; width: 18px; }
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
      next: () => {
        this.loading.set(false);
        // Land on a page the role can actually use.
        this.router.navigate([this.auth.canManageSales() ? '/orders' : '/products']);
      },
      error: (e) => { this.loading.set(false); this.notify.error(e, 'Login failed'); }
    });
  }
}
