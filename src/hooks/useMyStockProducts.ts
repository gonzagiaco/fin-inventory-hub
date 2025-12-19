import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOfflineData } from "@/lib/localDB";
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
  calculated_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface UseMyStockProductsOptions {
  supplierId?: string | null;
  searchTerm?: string;
  onlyWithStock?: boolean;
}

/**
 * Hook to fetch products for "My Stock" view.
 * Returns products where:
 * 1. quantity > 0 (currently in stock)
 * 2. OR updated_at > created_at (recently modified, even if quantity is 0)
 */
export function useMyStockProducts(options: UseMyStockProductsOptions = {}) {
  const { supplierId, searchTerm, onlyWithStock } = options;
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-stock", supplierId, searchTerm, onlyWithStock, isOnline ? "online" : "offline"],
    queryFn: async () => {
      // Fetch from IndexedDB (offline-first approach for this view)
      const indexedProducts = (await getOfflineData("dynamic_products_index")) as any[];
      const productLists = (await getOfflineData("product_lists")) as any[];
      
      if (!indexedProducts || !productLists) {
        return [];
      }

      // Create a map of list_id to supplier_id
      const listToSupplier = new Map<string, string>();
      productLists.forEach((list: any) => {
        listToSupplier.set(list.id, list.supplier_id);
      });

      // Filter products that should appear in My Stock:
      // 1. quantity > 0 OR
      // 2. updated_at > created_at (user modified it)
      let filtered = indexedProducts.filter((p: any) => {
        const hasStock = (p.quantity || 0) > 0;
        const wasModified = p.updated_at && p.created_at && 
          new Date(p.updated_at).getTime() > new Date(p.created_at).getTime();
        
        return hasStock || wasModified;
      });

      // Filter by supplier if specified
      if (supplierId && supplierId !== "all") {
        filtered = filtered.filter((p: any) => {
          const productSupplierId = listToSupplier.get(p.list_id);
          return productSupplierId === supplierId;
        });
      }

      // Filter by search term
      if (searchTerm && searchTerm.trim().length >= 1) {
        const lowerSearch = searchTerm.toLowerCase().trim();
        filtered = filtered.filter((p: any) => {
          return (
            p.code?.toLowerCase().includes(lowerSearch) ||
            p.name?.toLowerCase().includes(lowerSearch)
          );
        });
      }

      // Filter only products with stock > 0 if option is enabled
      if (onlyWithStock) {
        filtered = filtered.filter((p: any) => (p.quantity || 0) > 0);
      }

      // Sort by name
      filtered.sort((a: any, b: any) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB);
      });

      return filtered as MyStockProduct[];
    },
    staleTime: 0, // Always refetch to get real-time updates
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
 * Function to add a product to My Stock.
 * This effectively marks it as "modified" by updating its updated_at timestamp.
 */
export async function addToMyStock(
  productId: string,
  listId: string,
  isOnline: boolean
): Promise<void> {
  const { updateProductQuantityOffline } = await import("@/lib/localDB");
  
  // Get current product data
  const indexedProducts = (await getOfflineData("dynamic_products_index")) as any[];
  const product = indexedProducts?.find(
    (p: any) => p.product_id === productId && p.list_id === listId
  );
  
  const currentQuantity = product?.quantity || 0;
  
  if (isOnline) {
    // Update via Supabase - just touch the updated_at
    const { error } = await supabase
      .from("dynamic_products_index")
      .update({ 
        quantity: currentQuantity,
        updated_at: new Date().toISOString()
      })
      .eq("product_id", productId);
    
    if (error) throw error;
  } else {
    // Update via offline handler
    await updateProductQuantityOffline(productId, listId, currentQuantity);
  }
}
