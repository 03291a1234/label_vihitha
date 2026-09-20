export interface StoreVariant {
  id: number;
  size: string;
  available: number;
  inStock: boolean;
}

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
  variants: StoreVariant[];
  categoryImageUrl?: string | null;
  subCategoryImageUrl?: string | null;
}

export interface CartLine {
  product: StoreProduct;
  variant: StoreVariant;
  quantity: number;
}

export interface CheckoutResult {
  orderNumber: string;
  invoiceNumber: string;
  subTotal: number;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  customerName: string;
}

export interface PromoValidation {
  valid: boolean;
  discountAmount: number;
  message: string;
  code?: string | null;
}
