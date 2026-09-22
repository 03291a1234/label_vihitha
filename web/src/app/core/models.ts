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
  productCount: number;
  imageUrl?: string | null;
}

export interface SubCategory {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  productCount: number;
  sizes: string[];
  imageUrl?: string | null;
}

export interface Inventory {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  paidByOwnerId?: number | null;
  paidByOwnerName?: string | null;
  productCount: number;
  totalUnits: number;
  totalCostUsd: number;
  categories: CategoryCount[];
  bills: InventoryBill[];
  totalBillsUsd: number;
  soldRevenueUsd: number;
  soldCostUsd: number;
  initialCostUsd: number;
  profitUsd: number;
  allocatedExpenseUsd: number;
  netProfitUsd: number;
}

export interface ApplyShippingResult {
  productsUpdated: number;
  unitsCovered: number;
  perUnitUsd: number;
  totalUsd: number;
  markupPercent: number;
}

export interface RepriceResult {
  productsUpdated: number;
  markupPercent: number;
}

export interface Shipping {
  id: number;
  amountUsd: number;
  perUnitUsd: number;
  unitsCovered: number;
  markupPercent: number;
  appliedAt: string;
  productsAffected: number;
  note?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
}

export interface InventoryBill {
  id: number;
  fileUrl: string;
  fileName: string;
  amount?: number | null;
  billDate?: string | null;
  note?: string | null;
  vendorId?: number | null;
  vendorName?: string | null;
}

export interface Vendor {
  id: number;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isActive: boolean;
  productCount: number;
  totalUnits: number;
}

export interface SubCategoryCount {
  subCategoryId?: number | null;
  subCategoryName: string;
  productCount: number;
  totalUnits: number;
}
export interface CategoryCount {
  categoryId: number;
  categoryName: string;
  productCount: number;
  totalUnits: number;
  subCategories: SubCategoryCount[];
}
export interface InventorySummary {
  totalProducts: number;
  totalUnits: number;
  categories: CategoryCount[];
}

export type OwnerTransactionType = 'Contribution' | 'Withdrawal';

export type CashMovementKind = 'Transfer' | 'CashIn' | 'CashOut' | 'Opening';

export interface CashAccount {
  id: number;
  name: string;
  isCommon: boolean;
  ownerId?: number | null;
  ownerName?: string | null;
  balance: number;
  isActive: boolean;
  sortOrder: number;
}

export interface CashMovement {
  id: number;
  date: string;
  kind: CashMovementKind;
  amount: number;
  fromAccountId?: number | null;
  fromAccountName?: string | null;
  toAccountId?: number | null;
  toAccountName?: string | null;
  note?: string | null;
}

export interface CashOverview {
  accounts: CashAccount[];
  trackedTotal: number;
  expectedCash: number;
  difference: number;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  expenseCount: number;
}

export interface Expense {
  id: number;
  expenseCategoryId: number;
  expenseCategoryName: string;
  date: string;
  amount: number;
  description?: string | null;
  notes?: string | null;
  paidByOwnerId?: number | null;
  paidByOwnerName?: string | null;
  receiptUrl?: string | null;
  inventoryId?: number | null;
  inventoryName?: string | null;
}

export interface Owner {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  profitSharePercent: number;
  isActive: boolean;
  totalContributions: number;
  totalWithdrawals: number;
}

export interface OwnerTransaction {
  id: number;
  ownerId: number;
  date: string;
  type: OwnerTransactionType;
  amount: number;
  notes?: string | null;
}

export interface ExpenseLine {
  categoryId: number;
  categoryName: string;
  amount: number;
  pct: number;
}

export interface OwnerEquity {
  ownerId: number;
  name: string;
  sharePercent: number;
  contributions: number;
  withdrawals: number;
  profitShare: number;
  equity: number;
}

export interface ProfitLossReport {
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  expensesTotal: number;
  expensesByCategory: ExpenseLine[];
  netProfit: number;
  netMarginPct: number;
  orderCount: number;
  unitsSold: number;
  inventoryValueAtCost: number;
  inventoryValueAtSale: number;
  inventoryUnits: number;
  allTimeNetProfit: number;
  totalSharePercent: number;
  owners: OwnerEquity[];
  totalContributions: number;
  totalWithdrawals: number;
  totalOwnerEquity: number;
  inventoryFundedByOwner: OwnerInventory[];
  spendByVendor: VendorSpend[];
  allTimeCogs: number;
  allTimeExpenses: number;
  totalBillsRecorded: number;
  totalInvested: number;
  capitalDeployed: number;
  allTimeRevenue: number;
}

export interface OwnerInventory {
  ownerId?: number | null;
  ownerName: string;
  inventoryCost: number;
  units: number;
}

export interface VendorSpendInventory {
  inventoryId?: number | null;
  inventoryName: string;
  cost: number;
  units: number;
}

export interface VendorSpend {
  vendorId?: number | null;
  vendorName: string;
  totalCost: number;
  units: number;
  inventories: VendorSpendInventory[];
}

export interface ProductVariant {
  id: number;
  size: string;
  quantityOnHand: number;
  costPrice?: number | null;
  salePrice?: number | null;
}

export interface ProductCostComponent {
  id: number;
  label: string;
  vendorId?: number | null;
  vendorName?: string | null;
  amount: number;
}

export interface BulkSetPaidByRequest {
  categoryId?: number | null;
  subCategoryId?: number | null;
  inventoryId?: number | null;
  vendorId?: number | null;
  lowStockOnly: boolean;
  search?: string | null;
  paidByOwnerId: number | null;
  recordOwnerContribution: boolean;
}

export interface BulkSetPaidByResult {
  productsUpdated: number;
  totalCost: number;
  contributionPosted: boolean;
}

export interface ProductTotals {
  productCount: number;
  totalUnits: number;
  totalCostUsd: number;
  totalSaleUsd: number;
}

export type PromoDiscountType = 'Percentage' | 'FixedAmount';
export interface PromoCode {
  id: number;
  code: string;
  description?: string | null;
  discountType: PromoDiscountType;
  value: number;
  minOrderAmount?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  maxUses?: number | null;
  timesUsed: number;
  isActive: boolean;
}

export interface FilterOption { id: number; name: string; }
export interface ProductFilterOptions {
  categories: FilterOption[];
  subCategories: FilterOption[];
  inventories: FilterOption[];
  vendors: FilterOption[];
}

export interface ProductImportResult {
  productsCreated: number;
  variantsCreated: number;
  rowsProcessed: number;
  createdVendors: string[];
  createdInventories: string[];
  createdCategories: string[];
  createdSubCategories: string[];
  errors: string[];
}

export interface Product {
  id: number;
  categoryId: number;
  categoryName: string;
  subCategoryId?: number | null;
  subCategoryName?: string | null;
  inventoryId?: number | null;
  inventoryName?: string | null;
  vendorId?: number | null;
  vendorName?: string | null;
  paidByOwnerId?: number | null;
  paidByOwnerName?: string | null;
  sku: string;
  name: string;
  description?: string | null;
  size?: string | null;
  color?: string | null;
  material?: string | null;
  originalPrice: number;
  salePrice: number;
  quantityOnHand: number;
  unitsSold: number;
  reorderThreshold: number;
  isLowStock: boolean;
  imageUrl?: string | null;
  isActive: boolean;
  variants: ProductVariant[];
  costComponents: ProductCostComponent[];
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
  productVariantId?: number | null;
  size?: string | null;
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
  charges: OrderCharge[];
  chargesTotal: number;
}

export interface OrderCharge {
  id: number;
  label: string;
  amount: number;
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
  orderStatus: OrderStatus;
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
  orderStatus: OrderStatus;
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
