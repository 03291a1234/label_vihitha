export interface StoreProduct {
  id: number;
  sku: string;
  name: string;
  categoryName: string;
  subCategoryName?: string | null;
  price: number;
  imageUrl?: string | null;
  available: number;
  inStock: boolean;
}

export interface CartLine {
  product: StoreProduct;
  quantity: number;
}

export interface CheckoutResult {
  orderNumber: string;
  invoiceNumber: string;
  grandTotal: number;
  paymentMethod: string;
  customerName: string;
}
