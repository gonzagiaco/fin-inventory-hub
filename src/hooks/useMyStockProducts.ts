import { useQuery, useQueryClient } from "@tanstack/react-query";
import { localDB, updateProductQuantityOffline } from "@/lib/localDB";
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
  in_my_stock: boolean;
  stock_threshold: number;
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
  console.log(`[MyStock ${timestamp}] ${action}`, details || '');
};

/**
 * Hook to fetch products for "My Stock" view.
 * Criteria: in_my_stock = true
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
      logSync('Fetching my-stock products', { supplierId, searchTerm, onlyWithStock });

      // D) OPTIMIZACIÓN: Usar query indexada en lugar de getOfflineData
      // Filtrar directamente por in_my_stock = true usando índice Dexie
      let indexedProducts = await localDB.dynamic_products_index
        .filter(p => p.in_my_stock === true)
        .toArray();
      
      logSync(`Found ${indexedProducts.length} products with in_my_stock=true`);

      const productLists = await localDB.product_lists.toArray();
      
      if (!indexedProducts || !productLists) {
        return [];
      }

      // Create a map of list_id to supplier_id
      const listToSupplier = new Map<string, string>();
      productLists.forEach((list: any) => {
        listToSupplier.set(list.id, list.supplier_id);
      });

      // Filter by supplier if specified
      if (supplierId && supplierId !== "all") {
        indexedProducts = indexedProducts.filter((p: any) => {
          const productSupplierId = listToSupplier.get(p.list_id);
          return productSupplierId === supplierId;
        });
      }

      // Filter by search term
      if (searchTerm && searchTerm.trim().length >= 1) {
        const lowerSearch = searchTerm.toLowerCase().trim();
        indexedProducts = indexedProducts.filter((p: any) => {
          return (
            p.code?.toLowerCase().includes(lowerSearch) ||
            p.name?.toLowerCase().includes(lowerSearch)
          );
        });
      }

      // Filter only products with stock > 0 if option is enabled
      if (onlyWithStock) {
        indexedProducts = indexedProducts.filter((p: any) => (p.quantity || 0) > 0);
      }

      // D) OPTIMIZACIÓN: Bulk get de productos completos solo para los IDs filtrados
      const productIds = indexedProducts.map((p: any) => p.product_id);
      const fullProducts = await localDB.dynamic_products
        .where('id')
        .anyOf(productIds)
        .toArray();
      
      const productDataMap = new Map<string, any>();
      fullProducts.forEach((p: any) => {
        productDataMap.set(p.id, p.data || {});
      });

      // Enrich products with full data
      const enrichedProducts = indexedProducts.map((p: any) => ({
        ...p,
        data: productDataMap.get(p.product_id) || {},
      }));

      // Sort by name
      enrichedProducts.sort((a: any, b: any) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB);
      });

      const endTime = performance.now();
      logSync(`Query completed in ${(endTime - startTime).toFixed(2)}ms`, {
        totalProducts: enrichedProducts.length,
        filtered: indexedProducts.length
      });

      return enrichedProducts as MyStockProduct[];
    },
    staleTime: 0,
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
 * B) CORREGIDO: addToMyStock usa in_my_stock explícito
 * Sets in_my_stock = true, updates quantity if needed
 */
export async function addToMyStock(
  productId: string,
  listId: string,
  isOnline: boolean
): Promise<void> {
  logSync('addToMyStock', { productId, listId, isOnline });
  
  const now = new Date().toISOString();
  
  // Get current product data from IndexedDB
  const indexRecord = await localDB.dynamic_products_index
    .where({ product_id: productId, list_id: listId })
    .first();
  
  const currentQuantity = indexRecord?.quantity || 0;
  // Si quantity es 0, poner 1 para que sea visible
  const newQuantity = currentQuantity > 0 ? currentQuantity : 1;
  
  if (isOnline) {
    // Update via Supabase
    const { error } = await supabase
      .from("dynamic_products_index")
      .update({ 
        in_my_stock: true,
        quantity: newQuantity,
        updated_at: now
      })
      .eq("product_id", productId);
    
    if (error) {
      logSync('ERROR addToMyStock Supabase', error);
      throw error;
    }
    logSync('Supabase updated successfully');
  }
  
  // Update IndexedDB (always, for consistency)
  if (indexRecord) {
    await localDB.dynamic_products_index.update(indexRecord.id!, {
      in_my_stock: true,
      quantity: newQuantity,
      updated_at: now,
    });
    logSync('IndexedDB updated successfully');
  }
  
  // Queue for offline sync if not online
  if (!isOnline) {
    await localDB.pending_operations.add({
      table_name: 'dynamic_products_index',
      operation_type: 'UPDATE',
      record_id: productId,
      data: { in_my_stock: true, quantity: newQuantity },
      timestamp: Date.now(),
      retry_count: 0,
    });
    logSync('Queued operation for offline sync');
  }
}

/**
 * B) CORREGIDO: removeFromMyStock usa in_my_stock = false
 * NO resetea updated_at a created_at (prohibido)
 * Sets in_my_stock = false, quantity = 0
 */
export async function removeFromMyStock(
  productId: string,
  listId: string,
  isOnline: boolean
): Promise<void> {
  logSync('removeFromMyStock', { productId, listId, isOnline });
  
  const now = new Date().toISOString();
  
  if (isOnline) {
    // Update Supabase: in_my_stock = false, quantity = 0
    const { error } = await supabase
      .from("dynamic_products_index")
      .update({ 
        in_my_stock: false,
        quantity: 0,
        updated_at: now // NUNCA resetear a created_at
      })
      .eq("product_id", productId);
    
    if (error) {
      logSync('ERROR removeFromMyStock Supabase', error);
      throw error;
    }
    logSync('Supabase updated: in_my_stock=false, quantity=0');
  }
  
  // Update IndexedDB (always, for consistency)
  const indexRecord = await localDB.dynamic_products_index
    .where({ product_id: productId, list_id: listId })
    .first();
    
  if (indexRecord) {
    await localDB.dynamic_products_index.update(indexRecord.id!, {
      in_my_stock: false,
      quantity: 0,
      updated_at: now,
    });
    logSync('IndexedDB updated: in_my_stock=false, quantity=0');
  }
  
  // Queue for offline sync if not online
  if (!isOnline) {
    await localDB.pending_operations.add({
      table_name: 'dynamic_products_index',
      operation_type: 'UPDATE',
      record_id: productId,
      data: { in_my_stock: false, quantity: 0 },
      timestamp: Date.now(),
      retry_count: 0,
    });
    logSync('Queued operation for offline sync');
  }
}

/**
 * Sync individual product's in_my_stock state from Supabase to IndexedDB
 */
export async function syncProductMyStockState(productId: string): Promise<void> {
  logSync('syncProductMyStockState', { productId });
  
  const { data, error } = await supabase
    .from("dynamic_products_index")
    .select("in_my_stock, quantity, stock_threshold, updated_at")
    .eq("product_id", productId)
    .maybeSingle();
  
  if (error) {
    logSync('ERROR syncProductMyStockState', error);
    return;
  }
  
  if (!data) return;
  
  const indexRecord = await localDB.dynamic_products_index
    .where({ product_id: productId })
    .first();
    
  if (indexRecord) {
    await localDB.dynamic_products_index.update(indexRecord.id!, {
      in_my_stock: data.in_my_stock,
      quantity: data.quantity,
      stock_threshold: data.stock_threshold ?? 0,
      updated_at: data.updated_at,
    });
    logSync('Synced product state from Supabase', data);
  }
}

/**
 * Update the stock_threshold for a product
 * This is the per-product low stock threshold
 */
export async function updateStockThreshold(
  productId: string,
  threshold: number,
  isOnline: boolean
): Promise<void> {
  logSync('updateStockThreshold', { productId, threshold, isOnline });
  
  // Clamp to non-negative
  const validThreshold = Math.max(0, Math.floor(threshold));
  const now = new Date().toISOString();
  
  if (isOnline) {
    const { error } = await supabase
      .from("dynamic_products_index")
      .update({ 
        stock_threshold: validThreshold,
        updated_at: now
      })
      .eq("product_id", productId);
    
    if (error) {
      logSync('ERROR updateStockThreshold Supabase', error);
      throw error;
    }
    logSync('Supabase updated stock_threshold successfully');
  }
  
  // Update IndexedDB (always, for consistency)
  const indexRecord = await localDB.dynamic_products_index
    .where({ product_id: productId })
    .first();
    
  if (indexRecord) {
    await localDB.dynamic_products_index.update(indexRecord.id!, {
      stock_threshold: validThreshold,
      updated_at: now,
    });
    logSync('IndexedDB updated stock_threshold successfully');
  }
  
  // Queue for offline sync if not online
  if (!isOnline) {
    await localDB.pending_operations.add({
      table_name: 'dynamic_products_index',
      operation_type: 'UPDATE',
      record_id: productId,
      data: { stock_threshold: validThreshold },
      timestamp: Date.now(),
      retry_count: 0,
    });
    logSync('Queued stock_threshold update for offline sync');
  }
}
