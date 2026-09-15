import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Category, SubCategory, Inventory, Vendor, InventorySummary, Product, Customer, Order, OrderListItem, Invoice, InvoiceListItem,
  FollowUp, PagedResult, OrderStatus, PaymentMethod, PaymentStatus,
  ExpenseCategory, Expense, Owner, OwnerTransaction, OwnerTransactionType, ProfitLossReport
} from '../models';

const base = environment.apiUrl;

/** API origin (apiUrl without the trailing /api), used to resolve served image paths. */
export const apiOrigin = base.replace(/\/api\/?$/, '');

/** Resolves a stored ImageUrl to a loadable URL: absolute http(s) as-is, root-relative against the API origin. */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return apiOrigin + (url.startsWith('/') ? url : '/' + url);
}

function toParams(obj: Record<string, unknown>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class CategoryApi {
  constructor(private http: HttpClient) {}
  list(includeInactive = false): Observable<Category[]> {
    return this.http.get<Category[]>(`${base}/categories`, { params: toParams({ includeInactive }) });
  }
  get(id: number) { return this.http.get<Category>(`${base}/categories/${id}`); }
  create(body: Partial<Category>) { return this.http.post<Category>(`${base}/categories`, body); }
  update(id: number, body: Partial<Category>) { return this.http.put<Category>(`${base}/categories/${id}`, body); }
  remove(id: number) { return this.http.delete<void>(`${base}/categories/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class SubCategoryApi {
  constructor(private http: HttpClient) {}
  list(categoryId?: number | null, includeInactive = false): Observable<SubCategory[]> {
    return this.http.get<SubCategory[]>(`${base}/subcategories`, { params: toParams({ categoryId, includeInactive }) });
  }
  create(body: { categoryId: number; name: string; description?: string | null; sizes?: string[] }) {
    return this.http.post<SubCategory>(`${base}/subcategories`, body);
  }
  update(id: number, body: { name: string; description?: string | null; isActive: boolean; sizes?: string[] }) {
    return this.http.put<SubCategory>(`${base}/subcategories/${id}`, body);
  }
  remove(id: number) { return this.http.delete<void>(`${base}/subcategories/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class VendorApi {
  constructor(private http: HttpClient) {}
  list(includeInactive = false): Observable<Vendor[]> {
    return this.http.get<Vendor[]>(`${base}/vendors`, { params: toParams({ includeInactive }) });
  }
  get(id: number) { return this.http.get<Vendor>(`${base}/vendors/${id}`); }
  create(body: { name: string; contactPerson?: string | null; phone?: string | null; email?: string | null; notes?: string | null }) {
    return this.http.post<Vendor>(`${base}/vendors`, body);
  }
  update(id: number, body: { name: string; contactPerson?: string | null; phone?: string | null; email?: string | null; notes?: string | null; isActive: boolean }) {
    return this.http.put<Vendor>(`${base}/vendors/${id}`, body);
  }
  remove(id: number) { return this.http.delete<void>(`${base}/vendors/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  constructor(private http: HttpClient) {}
  list(includeInactive = false): Observable<Inventory[]> {
    return this.http.get<Inventory[]>(`${base}/inventories`, { params: toParams({ includeInactive }) });
  }
  get(id: number) { return this.http.get<Inventory>(`${base}/inventories/${id}`); }
  create(body: { name: string; description?: string | null }) {
    return this.http.post<Inventory>(`${base}/inventories`, body);
  }
  update(id: number, body: { name: string; description?: string | null; isActive: boolean }) {
    return this.http.put<Inventory>(`${base}/inventories/${id}`, body);
  }
  remove(id: number) { return this.http.delete<void>(`${base}/inventories/${id}`); }
}

export interface ProductFilters {
  categoryId?: number | null;
  subCategoryId?: number | null;
  inventoryId?: number | null;
  vendorId?: number | null;
  isActive?: boolean | null;
  lowStockOnly?: boolean;
  search?: string;
  sortBy?: string | null;
  sortDir?: string | null;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductApi {
  constructor(private http: HttpClient) {}
  list(filters: ProductFilters = {}): Observable<PagedResult<Product>> {
    return this.http.get<PagedResult<Product>>(`${base}/products`, { params: toParams(filters as Record<string, unknown>) });
  }
  get(id: number) { return this.http.get<Product>(`${base}/products/${id}`); }
  inventorySummary() { return this.http.get<InventorySummary>(`${base}/products/inventory-summary`); }
  create(body: unknown) { return this.http.post<Product>(`${base}/products`, body); }
  update(id: number, body: unknown) { return this.http.put<Product>(`${base}/products/${id}`, body); }
  remove(id: number) { return this.http.delete<void>(`${base}/products/${id}`); }

  uploadImage(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${base}/uploads/product-image`, form);
  }
}

@Injectable({ providedIn: 'root' })
export class CustomerApi {
  constructor(private http: HttpClient) {}
  list(search?: string): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${base}/customers`, { params: toParams({ search }) });
  }
  get(id: number) { return this.http.get<Customer>(`${base}/customers/${id}`); }
  create(body: Partial<Customer>) { return this.http.post<Customer>(`${base}/customers`, body); }
  update(id: number, body: Partial<Customer>) { return this.http.put<Customer>(`${base}/customers/${id}`, body); }
  remove(id: number) { return this.http.delete<void>(`${base}/customers/${id}`); }
}

export interface OrderFilters {
  customerId?: number | null;
  status?: OrderStatus | null;
  fromDate?: string | null;
  toDate?: string | null;
  search?: string;
  sortBy?: string | null;
  sortDir?: string | null;
  page?: number;
  pageSize?: number;
}

export interface CreateOrderItem { productId: number; quantity: number; finalPrice?: number | null; productVariantId?: number | null; }
export interface CreateOrder { customerId: number; notes?: string | null; items: CreateOrderItem[]; }

@Injectable({ providedIn: 'root' })
export class OrderApi {
  constructor(private http: HttpClient) {}
  list(filters: OrderFilters = {}): Observable<PagedResult<OrderListItem>> {
    return this.http.get<PagedResult<OrderListItem>>(`${base}/orders`, { params: toParams(filters as Record<string, unknown>) });
  }
  get(id: number) { return this.http.get<Order>(`${base}/orders/${id}`); }
  create(body: CreateOrder) { return this.http.post<Order>(`${base}/orders`, body); }
  setStatus(id: number, status: OrderStatus) { return this.http.put<Order>(`${base}/orders/${id}/status`, { status }); }
  addItem(id: number, item: CreateOrderItem) { return this.http.post<Order>(`${base}/orders/${id}/items`, item); }
  updateItem(id: number, itemId: number, body: { quantity: number; finalPrice?: number | null }) {
    return this.http.put<Order>(`${base}/orders/${id}/items/${itemId}`, body);
  }
  removeItem(id: number, itemId: number) { return this.http.delete<Order>(`${base}/orders/${id}/items/${itemId}`); }
}

export interface InvoiceFilters {
  paymentStatus?: PaymentStatus | null;
  paymentMethod?: PaymentMethod | null;
  fromDate?: string | null;
  toDate?: string | null;
  sortBy?: string | null;
  sortDir?: string | null;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class InvoiceApi {
  constructor(private http: HttpClient) {}
  list(filters: InvoiceFilters = {}): Observable<PagedResult<InvoiceListItem>> {
    return this.http.get<PagedResult<InvoiceListItem>>(`${base}/invoices`, { params: toParams(filters as Record<string, unknown>) });
  }
  get(id: number) { return this.http.get<Invoice>(`${base}/invoices/${id}`); }
  create(body: { orderId: number; paymentMethod: PaymentMethod; paymentReference?: string | null; notes?: string | null }) {
    return this.http.post<Invoice>(`${base}/invoices`, body);
  }
  update(id: number, body: { paymentMethod: PaymentMethod; paymentReference?: string | null; notes?: string | null; paymentStatus?: PaymentStatus | null }) {
    return this.http.put<Invoice>(`${base}/invoices/${id}`, body);
  }
  recordPayment(id: number, body: { amount: number; method: PaymentMethod; referenceNumber?: string | null }) {
    return this.http.post<Invoice>(`${base}/invoices/${id}/payments`, body);
  }
}

export interface FollowUpFilters {
  status?: FollowUp['status'] | null;
  overdueOnly?: boolean;
  openOnly?: boolean;
  createdBy?: string | null;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ExpenseCategoryApi {
  constructor(private http: HttpClient) {}
  list(includeInactive = false): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(`${base}/expense-categories`, { params: toParams({ includeInactive }) });
  }
  create(body: { name: string; description?: string | null }) {
    return this.http.post<ExpenseCategory>(`${base}/expense-categories`, body);
  }
  update(id: number, body: { name: string; description?: string | null; isActive: boolean }) {
    return this.http.put<ExpenseCategory>(`${base}/expense-categories/${id}`, body);
  }
  remove(id: number) { return this.http.delete<void>(`${base}/expense-categories/${id}`); }
}

export interface ExpenseFilters {
  categoryId?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
  sortBy?: string | null;
  sortDir?: string | null;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ExpenseApi {
  constructor(private http: HttpClient) {}
  list(filters: ExpenseFilters = {}): Observable<PagedResult<Expense>> {
    return this.http.get<PagedResult<Expense>>(`${base}/expenses`, { params: toParams(filters as Record<string, unknown>) });
  }
  create(body: { expenseCategoryId: number; date: string; amount: number; description?: string | null; notes?: string | null; paidByOwnerId?: number | null; receiptUrl?: string | null }) {
    return this.http.post<Expense>(`${base}/expenses`, body);
  }
  update(id: number, body: { expenseCategoryId: number; date: string; amount: number; description?: string | null; notes?: string | null; paidByOwnerId?: number | null; receiptUrl?: string | null }) {
    return this.http.put<Expense>(`${base}/expenses/${id}`, body);
  }
  remove(id: number) { return this.http.delete<void>(`${base}/expenses/${id}`); }

  uploadReceipt(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${base}/uploads/receipt`, form);
  }
}

@Injectable({ providedIn: 'root' })
export class OwnerApi {
  constructor(private http: HttpClient) {}
  list(includeInactive = false): Observable<Owner[]> {
    return this.http.get<Owner[]>(`${base}/owners`, { params: toParams({ includeInactive }) });
  }
  create(body: { name: string; email?: string | null; phone?: string | null; notes?: string | null; profitSharePercent: number }) {
    return this.http.post<Owner>(`${base}/owners`, body);
  }
  update(id: number, body: { name: string; email?: string | null; phone?: string | null; notes?: string | null; profitSharePercent: number; isActive: boolean }) {
    return this.http.put<Owner>(`${base}/owners/${id}`, body);
  }
  remove(id: number) { return this.http.delete<void>(`${base}/owners/${id}`); }
  transactions(ownerId: number): Observable<OwnerTransaction[]> {
    return this.http.get<OwnerTransaction[]>(`${base}/owners/${ownerId}/transactions`);
  }
  addTransaction(ownerId: number, body: { date: string; type: OwnerTransactionType; amount: number; notes?: string | null }) {
    return this.http.post<OwnerTransaction>(`${base}/owners/${ownerId}/transactions`, body);
  }
  removeTransaction(ownerId: number, transactionId: number) {
    return this.http.delete<void>(`${base}/owners/${ownerId}/transactions/${transactionId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class FinanceApi {
  constructor(private http: HttpClient) {}
  profitLoss(fromDate?: string | null, toDate?: string | null): Observable<ProfitLossReport> {
    return this.http.get<ProfitLossReport>(`${base}/finance/profit-loss`, { params: toParams({ fromDate, toDate }) });
  }
}

@Injectable({ providedIn: 'root' })
export class FollowUpApi {
  constructor(private http: HttpClient) {}
  listForOrder(orderId: number) { return this.http.get<FollowUp[]>(`${base}/orders/${orderId}/follow-ups`); }
  createForOrder(orderId: number, body: { note: string; orderItemId?: number | null; followUpDate?: string | null }) {
    return this.http.post<FollowUp>(`${base}/orders/${orderId}/follow-ups`, body);
  }
  dashboard(filters: FollowUpFilters = {}): Observable<PagedResult<FollowUp>> {
    return this.http.get<PagedResult<FollowUp>>(`${base}/follow-ups`, { params: toParams(filters as Record<string, unknown>) });
  }
  update(id: number, body: { status: FollowUp['status']; note?: string | null; followUpDate?: string | null; resolutionNote?: string | null }) {
    return this.http.put<FollowUp>(`${base}/follow-ups/${id}`, body);
  }
}
