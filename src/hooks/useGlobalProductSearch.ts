import { useState, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineData } from "@/lib/localDB";

interface GlobalProductSearchOptions {
  searchTerm: string;
  supplierFilter?: string;
  minSearchLength?: number;
  pageSize?: number;
}

export function useGlobalProductSearch({
  searchTerm,
  supplierFilter = "all",
  minSearchLength = 1,
  pageSize = 50,
}: GlobalProductSearchOptions) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const shouldSearch = searchTerm.trim().length >= minSearchLength;

  const query = useInfiniteQuery({
    queryKey: ["global-product-search", searchTerm, supplierFilter, isOnline ? "online" : "offline"],
    queryFn: async ({ pageParam = 0 }) => {
      if (!shouldSearch) return { data: [], count: 0, nextPage: undefined };

      // MODO OFFLINE
      if (!isOnline) {
        return searchOffline(searchTerm, supplierFilter, pageParam, pageSize);
      }

      // MODO ONLINE
      return searchOnline(searchTerm, supplierFilter, pageParam, pageSize);
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: shouldSearch,
    retry: false,
    initialPageParam: 0,
  });

  return {
    ...query,
    isOnline,
  };
}

/**
 * Búsqueda online usando search_products RPC
 */
async function searchOnline(
  searchTerm: string,
  supplierFilter: string,
  pageParam: number,
  pageSize: number
) {
  const offset = pageParam * pageSize;

  let rpcCall = supabase.rpc("search_products", {
    p_term: searchTerm.trim(),
    p_limit: pageSize,
    p_offset: offset,
    p_list_id: null,
    p_supplier_id: supplierFilter !== "all" ? supplierFilter : null,
  });

  const { data, error, count } = await rpcCall;

  if (error) {
    console.error("❌ Error en búsqueda online:", error);
    throw error;
  }

  const hasMore = data && data.length === pageSize;
  const nextPage = hasMore ? pageParam + 1 : undefined;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let enrichedData = data || [];
  if (user && data && data.length > 0) {
    const productIds = data.map((item: any) => item.product_id);
    const { data: myStockRows, error: myStockError } = await supabase
      .from("my_stock_products")
      .select("product_id")
      .eq("user_id", user.id)
      .in("product_id", productIds);

    if (myStockError) throw myStockError;

    const stockIds = new Set((myStockRows || []).map((row: any) => row.product_id));
    enrichedData = data.map((item: any) => ({
      ...item,
      in_my_stock: stockIds.has(item.product_id),
    }));
  }

  return {
    data: enrichedData,
    count: count || 0,
    nextPage,
  };
}

/**
 * Búsqueda offline en IndexedDB
 */
async function searchOffline(
  searchTerm: string,
  supplierFilter: string,
  pageParam: number,
  pageSize: number
) {
  const indexedProducts = (await getOfflineData("dynamic_products_index")) as any[];
  const fullProducts = (await getOfflineData("dynamic_products")) as any[];
  const productLists = (await getOfflineData("product_lists")) as any[];
  const myStockEntries = (await getOfflineData("my_stock_products")) as any[];
  const myStockIds = new Set(myStockEntries.map((entry: any) => entry.product_id));
  
  const searchTermLower = searchTerm.trim().toLowerCase();

  // Filtrar por término de búsqueda
  let filtered = indexedProducts.filter((p: any) => {
    // Buscar en índice
    if (p.code?.toLowerCase().includes(searchTermLower) || p.name?.toLowerCase().includes(searchTermLower)) {
      return true;
    }

    // Buscar en producto completo usando mapping_config
    const fullProduct = fullProducts.find((fp: any) => fp.id === p.product_id);
    if (!fullProduct?.data) return false;

    const list = productLists.find((l: any) => l.id === p.list_id);
    const mappingConfig = list?.mapping_config;

    // Buscar en code_keys
    if (mappingConfig?.code_keys && Array.isArray(mappingConfig.code_keys)) {
      for (const key of mappingConfig.code_keys) {
        if (fullProduct.data[key]?.toString().toLowerCase().includes(searchTermLower)) {
          return true;
        }
      }
    }

    // Buscar en name_keys
    if (mappingConfig?.name_keys && Array.isArray(mappingConfig.name_keys)) {
      for (const key of mappingConfig.name_keys) {
        if (fullProduct.data[key]?.toString().toLowerCase().includes(searchTermLower)) {
          return true;
        }
      }
    }

    return false;
  });

  // Filtrar por proveedor
  if (supplierFilter !== "all") {
    const listsBySupplier = productLists.filter((l: any) => l.supplier_id === supplierFilter).map((l: any) => l.id);
    filtered = filtered.filter((p: any) => listsBySupplier.includes(p.list_id));
  }

  // Paginación
  const start = pageParam * pageSize;
  const end = start + pageSize;
  const paginatedData = filtered.slice(start, end).map((item: any) => ({
    ...item,
    in_my_stock: myStockIds.has(item.product_id),
  }));

  return {
    data: paginatedData,
    count: filtered.length,
    nextPage: end < filtered.length ? pageParam + 1 : undefined,
  };
}


