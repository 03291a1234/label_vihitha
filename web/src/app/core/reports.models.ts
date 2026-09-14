export interface DashboardSummary {
  fromDate: string;
  toDate: string;
  totalRevenue: number;
  totalCost: number;
  grossMargin: number;
  marginPercent: number;
  orderCount: number;
  unitsSold: number;
  outstandingInvoiceAmount: number;
  openFollowUps: number;
  overdueFollowUps: number;
  lowStockCount: number;
}

export interface MarginByCategory {
  categoryId: number; categoryName: string;
  originalCost: number; saleValue: number; finalRevenue: number;
  discount: number; margin: number; marginPercent: number; unitsSold: number;
}
export interface MarginByDate {
  bucket: string; originalCost: number; finalRevenue: number; margin: number; marginPercent: number;
}
export interface MarginReport {
  fromDate: string; toDate: string;
  totalOriginalCost: number; totalSaleValue: number; totalFinalRevenue: number;
  totalDiscount: number; grossMargin: number; marginPercent: number;
  unitsSold: number; orderCount: number;
  byCategory: MarginByCategory[]; byDate: MarginByDate[];
}

export interface SalesByCategoryRow {
  categoryId: number; categoryName: string;
  unitsSold: number; revenue: number; saleValue: number;
  discountTotal: number; avgDiscountPercentOffSale: number;
}
export interface SalesByCategoryReport { fromDate: string; toDate: string; rows: SalesByCategoryRow[]; }

export interface InventoryValuationRow {
  categoryId: number; categoryName: string;
  products: number; unitsOnHand: number; valueAtOriginal: number; valueAtSale: number;
}
export interface InventoryValuationReport {
  totalAtOriginal: number; totalAtSale: number; totalUnits: number; rows: InventoryValuationRow[];
}

export interface PaymentMethodRow { method: string; paymentCount: number; amountPaid: number; share: number; }
export interface PaymentMethodReport { fromDate: string; toDate: string; totalPaid: number; rows: PaymentMethodRow[]; }

export interface MoverRow {
  productId: number; sku: string; name: string; categoryName: string;
  unitsSold: number; revenue: number; quantityOnHand: number;
}
export interface MoversReport { fromDate: string; toDate: string; topMovers: MoverRow[]; slowMovers: MoverRow[]; }
