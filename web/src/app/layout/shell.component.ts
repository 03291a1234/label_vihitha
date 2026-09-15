import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../core/auth/auth.service';

interface NavItem { label: string; icon: string; path: string; show: () => boolean; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatSidenavModule, MatListModule, MatIconModule, MatButtonModule, MatMenuModule
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav #snav mode="side" opened class="sidenav">
        <a class="brand" [routerLink]="homePath()" title="Home">
          <span class="emblem"><img src="logo.jpeg" alt="Vihitha" /></span>
          <div class="brand-text">
            <div class="name">Vihitha</div>
          </div>
        </a>
        <mat-nav-list>
          @for (item of nav; track item.path) {
            @if (item.show()) {
            <a mat-list-item [routerLink]="item.path" routerLinkActive="active-link">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
            }
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="topbar">
          <button mat-icon-button (click)="snav.toggle()"><mat-icon>menu</mat-icon></button>
          <span class="spacer"></span>
          <button mat-button [matMenuTriggerFor]="menu">
            <mat-icon>account_circle</mat-icon>
            {{ auth.userName() }}
          </button>
          <mat-menu #menu="matMenu">
            <div class="menu-roles">Roles: {{ auth.roles().join(', ') || '—' }}</div>
            <button mat-menu-item (click)="auth.logout()">
              <mat-icon>logout</mat-icon><span>Sign out</span>
            </button>
          </mat-menu>
        </mat-toolbar>

        <main>
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .shell { height: 100vh; }
    .sidenav {
      width: 256px; border: none; color: #f6e9ef;
      background: linear-gradient(185deg, #5a1a38 0%, #3f1228 100%);
    }

    /* Brand lockup — echoes the circular gold-on-wine logo */
    .brand { display: flex; align-items: center; gap: 14px; padding: 24px 20px 18px; text-decoration: none; }
    .emblem {
      width: 50px; height: 50px; border-radius: 50%; flex: 0 0 auto;
      display: grid; place-items: center; overflow: hidden; background: #fbf5ea;
      border: 2px solid #c39a3e; box-shadow: 0 0 0 4px rgba(201,154,62,.10);
    }
    .emblem img { width: 122%; height: 122%; object-fit: cover; }
    .brand .name {
      font-family: "Cormorant Garamond", Georgia, serif; font-size: 24px; font-weight: 700;
      color: #fff; line-height: 1;
    }

    /* Nav — high-contrast labels fix the readability issue */
    mat-nav-list { padding-top: 6px; }
    mat-nav-list a {
      color: #f3e4ec !important; border-radius: 12px; margin: 3px 12px;
      --mdc-list-list-item-label-text-color: #f3e4ec;
      --mdc-list-list-item-hover-label-text-color: #ffffff;
    }
    mat-nav-list a span[matListItemTitle] { font-weight: 500; letter-spacing: .2px; }
    mat-nav-list mat-icon { color: #e4b7cb; }
    mat-nav-list a:hover { background: rgba(255,255,255,.06); }
    .active-link {
      background: rgba(201,154,62,.16) !important;
      box-shadow: inset 3px 0 0 #c39a3e;
    }
    .active-link, .active-link span[matListItemTitle] { color: #ffffff !important; }
    .active-link mat-icon { color: #e9c877; }

    /* Toolbar — ivory bar with wine text (premium, matches the logo ground) */
    .topbar {
      position: sticky; top: 0; z-index: 10;
      background: #fffdfa; color: var(--lv-wine);
      border-bottom: 1px solid var(--lv-line);
      box-shadow: 0 2px 10px rgba(110,31,62,.04);
    }
    .topbar button, .topbar .mat-icon { color: var(--lv-wine); }
    .menu-roles { padding: 8px 16px; font-size: 12px; color: rgba(0,0,0,.6); }
    main { display: block; }
  `]
})
export class ShellComponent {
  auth = inject(AuthService);

  /** Clicking the logo goes to the product catalog (home). */
  homePath() { return '/products'; }

  nav: NavItem[] = [
    { label: 'Analytics', icon: 'insights', path: '/analytics', show: () => this.auth.canViewReports() },
    { label: 'Profit & Loss', icon: 'account_balance', path: '/profit-loss', show: () => this.auth.canViewReports() },
    { label: 'Orders', icon: 'receipt_long', path: '/orders', show: () => this.auth.canManageSales() },
    { label: 'Invoicing', icon: 'payments', path: '/invoices', show: () => this.auth.canManageSales() },
    { label: 'Follow-ups', icon: 'task_alt', path: '/follow-ups', show: () => this.auth.canManageSales() },
    { label: 'Products', icon: 'inventory_2', path: '/products', show: () => true },
    { label: 'Inventories', icon: 'inventory', path: '/inventories', show: () => true },
    { label: 'Categories', icon: 'category', path: '/categories', show: () => true },
    { label: 'Vendors', icon: 'storefront', path: '/vendors', show: () => true },
    { label: 'Expenses', icon: 'payments', path: '/expenses', show: () => this.auth.canViewReports() },
    { label: 'Owners', icon: 'diversity_3', path: '/owners', show: () => this.auth.canViewReports() },
    { label: 'Customers', icon: 'group', path: '/customers', show: () => this.auth.canManageSales() }
  ];
}
