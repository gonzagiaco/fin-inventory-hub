import type { ColumnSchema } from "./productList";

export interface EnrichedProduct {
  id: string;
  listId: string;
  code?: string;
  name?: string;
  price?: number;
  quantity?: number;
  data: Record<string, any>;
  calculated_data?: Record<string, number>;
  supplierName: string;
  supplierLogo?: string;
  supplierId: string;
}

export interface ProductListDetails {
  listId: string;
  listName: string;
  supplierId: string;
  supplierName: string;
  supplierLogo: string | null;
  columnSchema: ColumnSchema[];
  productCount: number;
}
