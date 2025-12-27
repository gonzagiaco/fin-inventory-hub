import { useQuery, useQueryClient } from "@tanstack/react-query";
import { localDB } from "@/lib/localDB";
import { useOnlineStatus } from "./useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";

export interface MyStockProduct {
  id: string;
  product_id: string;
  list_id: string;
  code: string | null;
  name: string | null;
  price: number | null;
  quantity: number | null;
  stock_threshold?: number | null;
  calculated_data?: Record<string, any>;
  data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface UseMyStockProductsOptions {
  supplierId?: string | null;
  searchTerm?: string;
  onlyWithStock?: boolean;
}

// Logging helper
const logSync = (action: string, details?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[MyStock ${timestamp}] ${action}`, details || "");
};

/**
 * Hook to fetch products for "My Stock" view.
 * Criteria: presence in my_stock_products
 * Uses indexed queries for performance (no full table scans)
 */
export function useMyStockProducts(options: UseMyStockProductsOptions = {}) {
  const { supplierId, searchTerm, onlyWithStock } = options;
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-stock", supplierId, searchTerm, onlyWithStock, isOnline ? "online" : "offline"],
    queryFn: async () => {
      const startTime = performance.now();
      logSync("Fetching my-stock products", { supplierId, searchTerm, onlyWithStock });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      let myStockEntries = await localDB.my_stock_products.where({ user_id: user.id }).toArray();

      if (!myStockEntries.length) {
        return [];
      }

      const productIds = myStockEntries.map((entry) => entry.product_id);
      const [fullProducts, indexEntries, productLists] = await Promise.all([
        localDB.dynamic_products.bulkGet(productIds),
        localDB.dynamic_products_index.where("product_id").anyOf(productIds).toArray(),
        localDB.product_lists.toArray(),
      ]);

      const fullProductsMap = new Map<string, any>();
      fullProducts.forEach((p) => {
        if (p) fullProductsMap.set(p.id, p);
      });

      const indexByProductId = new Map<string, any>();
      indexEntries.forEach((p) => indexByProductId.set(p.product_id, p));

      const listToSupplier = new Map<string, string>();
      productLists.forEach((list: any) => {
        listToSupplier.set(list.id, list.supplier_id);
      });

      let enrichedProducts = myStockEntries.map((entry) => {
        const fullProduct = fullProductsMap.get(entry.product_id);
        const indexRecord = indexByProductId.get(entry.product_id);

        return {
          ...entry,
          list_id: fullProduct?.list_id ?? indexRecord?.list_id ?? "",
          data: fullProduct?.data || {},
          calculated_data: indexRecord?.calculated_data || {},
          code: entry.code ?? indexRecord?.code ?? fullProduct?.code ?? "",
          name: entry.name ?? indexRecord?.name ?? fullProduct?.name ?? "",
          price: entry.price ?? indexRecord?.price ?? fullProduct?.price ?? null,
          quantity: entry.quantity ?? 0,
          stock_threshold: entry.stock_threshold ?? 0,
        };
      });

      if (supplierId && supplierId !== "all") {
        enrichedProducts = enrichedProducts.filter((p: any) => listToSupplier.get(p.list_id) === supplierId);
      }

      if (searchTerm && searchTerm.trim().length >= 1) {
        const lowerSearch = searchTerm.toLowerCase().trim();
        enrichedProducts = enrichedProducts.filter((p: any) => {
          return p.code?.toLowerCase().includes(lowerSearch) || p.name?.toLowerCase().includes(lowerSearch);
        });
      }

      if (onlyWithStock) {
        enrichedProducts = enrichedProducts.filter((p: any) => (p.quantity || 0) > 0);
      }

      enrichedProducts.sort((a: any, b: any) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB);
      });

      const endTime = performance.now();
      logSync(`Query completed in ${(endTime - startTime).toFixed(2)} ms`, {
        totalProducts: enrichedProducts.length,
      });

      return enrichedProducts as MyStockProduct[];
    },
    staleTime: Infinity,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-stock"] });
  };

  return {
    ...query,
    invalidate,
  };
}

/**
 * Sync individual product's my_stock state from Supabase to IndexedDB
 */
export async function syncProductMyStockState(productId: string): Promise<void> {
  logSync("syncProductMyStockState", { productId });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from("my_stock_products")
    .select("id, product_id, user_id, quantity, stock_threshold, code, name, price, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    logSync("ERROR syncProductMyStockState", error);
    return;
  }

  const existing = await localDB.my_stock_products.where({ user_id: user.id, product_id: productId }).first();

  if (!data) {
    if (existing) {
      await localDB.my_stock_products.delete(existing.id);
    }
    return;
  }

  if (existing) {
    await localDB.my_stock_products.update(existing.id, {
      quantity: data.quantity ?? 0,
      stock_threshold: data.stock_threshold ?? 0,
      code: data.code ?? existing.code,
      name: data.name ?? existing.name,
      price: data.price ?? existing.price,
      updated_at: data.updated_at,
    });
  } else {
    await localDB.my_stock_products.add(data);
  }

  await localDB.dynamic_products_index.where({ product_id: productId }).modify({
    quantity: data.quantity ?? 0,
    stock_threshold: data.stock_threshold ?? 0,
    updated_at: data.updated_at,
  });
}
