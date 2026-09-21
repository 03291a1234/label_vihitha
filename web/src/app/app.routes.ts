import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'shop',
    loadComponent: () => import('./store/shop.component').then(m => m.ShopComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'orders' },
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/order-list.component').then(m => m.OrderListComponent)
      },
      {
        path: 'orders/new',
        loadComponent: () => import('./features/orders/order-create.component').then(m => m.OrderCreateComponent)
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./features/orders/order-detail.component').then(m => m.OrderDetailComponent)
      },
      {
        path: 'invoices',
        loadComponent: () => import('./features/invoices/invoice-list.component').then(m => m.InvoiceListComponent)
      },
      {
        path: 'invoices/:id',
        loadComponent: () => import('./features/invoices/invoice-detail.component').then(m => m.InvoiceDetailComponent)
      },
      {
        path: 'follow-ups',
        loadComponent: () => import('./features/follow-ups/followup-dashboard.component').then(m => m.FollowUpDashboardComponent)
      },
      {
        path: 'products',
        loadComponent: () => import('./features/inventory/product-list.component').then(m => m.ProductListComponent)
      },
      {
        path: 'inventories',
        loadComponent: () => import('./features/inventories/inventory-list.component').then(m => m.InventoryListComponent)
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/categories/category-list.component').then(m => m.CategoryListComponent)
      },
      {
        path: 'vendors',
        loadComponent: () => import('./features/vendors/vendor-list.component').then(m => m.VendorListComponent)
      },
      {
        path: 'expenses',
        loadComponent: () => import('./features/finance/expense-list.component').then(m => m.ExpenseListComponent)
      },
      {
        path: 'owners',
        loadComponent: () => import('./features/finance/owner-list.component').then(m => m.OwnerListComponent)
      },
      {
        path: 'profit-loss',
        loadComponent: () => import('./features/finance/profit-loss.component').then(m => m.ProfitLossComponent)
      },
      {
        path: 'cash',
        loadComponent: () => import('./features/finance/cash-accounts.component').then(m => m.CashAccountsComponent)
      },
      {
        path: 'customers',
        loadComponent: () => import('./features/customers/customer-list.component').then(m => m.CustomerListComponent)
      },
      {
        path: 'audit',
        loadComponent: () => import('./features/audit/audit-log.component').then(m => m.AuditLogComponent)
      },
      {
        path: 'promo-codes',
        loadComponent: () => import('./features/promotions/promo-code-list.component').then(m => m.PromoCodeListComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
