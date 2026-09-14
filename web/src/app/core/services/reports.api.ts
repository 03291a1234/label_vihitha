import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  DashboardSummary, MarginReport, SalesByCategoryReport,
  InventoryValuationReport, PaymentMethodReport, MoversReport
} from '../reports.models';

const base = environment.apiUrl;

export interface DateRange { fromDate?: string | null; toDate?: string | null; }

function params(obj: object): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  constructor(private http: HttpClient) {}

  summary(range: DateRange) {
    return this.http.get<DashboardSummary>(`${base}/reports/summary`, { params: params(range) });
  }
  margin(range: DateRange, bucket = 'Month') {
    return this.http.get<MarginReport>(`${base}/reports/margin`, { params: params({ ...range, bucket }) });
  }
  salesByCategory(range: DateRange) {
    return this.http.get<SalesByCategoryReport>(`${base}/reports/sales-by-category`, { params: params(range) });
  }
  inventoryValuation() {
    return this.http.get<InventoryValuationReport>(`${base}/reports/inventory-valuation`);
  }
  paymentMethods(range: DateRange) {
    return this.http.get<PaymentMethodReport>(`${base}/reports/payment-methods`, { params: params(range) });
  }
  movers(range: DateRange, take = 5) {
    return this.http.get<MoversReport>(`${base}/reports/movers`, { params: params({ ...range, take }) });
  }
}
