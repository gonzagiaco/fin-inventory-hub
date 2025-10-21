export interface ColumnSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date';
  visible: boolean;
  order: number;
  isStandard?: boolean; // code, name, price
}

export interface DynamicProduct {
  id: string;
  listId: string;
  code?: string;
  name?: string;
  price?: number;
  quantity?: number;
  data: Record<string, any>; // All extra fields
}

export interface ProductList {
  id: string;
  supplierId: string;
  name: string;
  fileName: string;
  fileType: string;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  columnSchema: ColumnSchema[];
}

export interface ProcessedDocument {
  proveedor: string;
  productos: Array<{
    code?: string;
    name?: string;
    descripcion?: string;
    price?: number;
    precio?: number;
    cantidad?: number;
    [key: string]: any;
  }>;
}
