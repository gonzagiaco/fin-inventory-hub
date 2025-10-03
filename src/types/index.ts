export interface StockItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  category: string;
}

export interface Client {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
  phone?: string;
  email?: string;
}

export type CategoryFilter = "Todas" | "Fruits" | "Bakery" | "Dairy" | "Produce";
export type QuantityFilter = "Cualquiera" | "< 100" | "100 - 200" | "> 200";
