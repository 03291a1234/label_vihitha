export type OrderStatus = 'Pending' | 'Confirmed' | 'Fulfilled' | 'Cancelled';
export type PaymentMethod = 'Zelle' | 'Cash';
export type PaymentStatus = 'Unpaid' | 'PartiallyPaid' | 'Paid' | 'Refunded';

export interface AuthResponse {
  accessToken: string;
  expiresAtUtc: string;
  userName: string;
  roles: string[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Product {
  id: number;
  categoryName: string;
  sku: string;
  name: string;
  color?: string | null;
  originalPrice: number;
  salePrice: number;
  quantityOnHand: number;
  isLowStock: boolean;
  isActive: boolean;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
}

export interface OrderItem {
  id: number;
  productName: string;
  sku: string;
  quantity: number;
  finalPriceAtSale: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  grandTotal: number;
  hasInvoice: boolean;
  invoiceId?: number | null;
  items: OrderItem[];
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  paymentMethod: PaymentMethod;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  paymentStatus: PaymentStatus;
}

export interface DashboardSummary {
  totalRevenue: number;
  grossMargin: number;
  marginPercent: number;
  orderCount: number;
  unitsSold: number;
  outstandingInvoiceAmount: number;
  lowStockCount: number;
}
