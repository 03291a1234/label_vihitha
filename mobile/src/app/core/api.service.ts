import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Product, Customer, Order, Invoice, PagedResult, DashboardSummary, PaymentMethod } from './models';

const base = environment.apiUrl;

export interface CreateOrderItem { productId: number; quantity: number; finalPrice?: number | null; }
export interface CreateOrder { customerId: number; notes?: string | null; items: CreateOrderItem[]; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  products(search?: string) {
    let p = new HttpParams().set('pageSize', '100').set('isActive', 'true');
    if (search) p = p.set('search', search);
    return this.http.get<PagedResult<Product>>(`${base}/products`, { params: p });
  }

  customers(search?: string) {
    let p = new HttpParams();
    if (search) p = p.set('search', search);
    return this.http.get<Customer[]>(`${base}/customers`, { params: p });
  }

  createCustomer(name: string, phone?: string | null) {
    return this.http.post<Customer>(`${base}/customers`, { name, phone: phone || null });
  }

  createOrder(body: CreateOrder) {
    return this.http.post<Order>(`${base}/orders`, body);
  }

  setStatus(orderId: number, status: string) {
    return this.http.put<Order>(`${base}/orders/${orderId}/status`, { status });
  }

  createInvoice(orderId: number, paymentMethod: PaymentMethod, paymentReference?: string | null) {
    return this.http.post<Invoice>(`${base}/invoices`, { orderId, paymentMethod, paymentReference: paymentReference || null });
  }

  recordPayment(invoiceId: number, amount: number, method: PaymentMethod, referenceNumber?: string | null) {
    return this.http.post<Invoice>(`${base}/invoices/${invoiceId}/payments`, { amount, method, referenceNumber: referenceNumber || null });
  }

  summary() {
    return this.http.get<DashboardSummary>(`${base}/reports/summary`);
  }
}
