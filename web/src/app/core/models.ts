// DTOs mirrored from the .NET API.

export type OrderStatus = 'Pending' | 'Confirmed' | 'Fulfilled' | 'Cancelled';
export type PaymentMethod = 'Zelle' | 'Cash';
export type PaymentStatus = 'Unpaid' | 'PartiallyPaid' | 'Paid' | 'Refunded';
export type FollowUpStatus = 'Open' | 'InProgress' | 'Resolved';

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

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  defaultOriginalPrice?: number | null;
  defaultSalePrice?: number | null;
  productCount: number;
}

export interface Product {
  id: number;
  categoryId: number;
  categoryName: string;
  sku: string;
  name: string;
  description?: string | null;
  size?: string | null;
  color?: string | null;
  material?: string | null;
  originalPrice: number;
  salePrice: number;
  quantityOnHand: number;
  reorderThreshold: number;
  isLowStock: boolean;
  imageUrl?: string | null;
  isActive: boolean;
  rowVersion: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  orderCount: number;
}

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  originalPriceAtSale: number;
  salePriceAtSale: number;
  finalPriceAtSale: number;
  discountAmount: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  orderDate: string;
  status: OrderStatus;
  subTotal: number;
  discountTotal: number;
  grandTotal: number;
  notes?: string | null;
  createdBy?: string | null;
  hasInvoice: boolean;
  invoiceId?: number | null;
  items: OrderItem[];
}

export interface OrderListItem {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  orderDate: string;
  status: OrderStatus;
  grandTotal: number;
  itemCount: number;
  hasInvoice: boolean;
}

export interface Payment {
  id: number;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  referenceNumber?: string | null;
  recordedBy?: string | null;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  orderId: number;
  orderNumber: string;
  customerName: string;
  invoiceDate: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string | null;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  paymentStatus: PaymentStatus;
  paidDate?: string | null;
  notes?: string | null;
  payments: Payment[];
}

export interface InvoiceListItem {
  id: number;
  invoiceNumber: string;
  orderId: number;
  orderNumber: string;
  customerName: string;
  invoiceDate: string;
  paymentMethod: PaymentMethod;
  amountDue: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
}

export interface FollowUp {
  id: number;
  orderId: number;
  orderNumber: string;
  orderItemId?: number | null;
  productName?: string | null;
  note: string;
  followUpDate?: string | null;
  status: FollowUpStatus;
  createdBy?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  isOverdue: boolean;
}
