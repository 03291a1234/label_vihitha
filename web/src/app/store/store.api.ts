import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { StoreProduct, CheckoutResult } from './store.models';

const base = environment.apiUrl;

export interface CheckoutBody {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  paymentMethod: 'Zelle' | 'Cash';
  notes?: string | null;
  items: { productId: number; quantity: number }[];
}

@Injectable({ providedIn: 'root' })
export class StoreApi {
  private http = inject(HttpClient);

  products(search?: string) {
    let p = new HttpParams();
    if (search) p = p.set('search', search);
    return this.http.get<StoreProduct[]>(`${base}/store/products`, { params: p });
  }

  checkout(body: CheckoutBody) {
    return this.http.post<CheckoutResult>(`${base}/store/checkout`, body);
  }
}
