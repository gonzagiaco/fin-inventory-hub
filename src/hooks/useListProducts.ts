import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getProductsForListOffline } from "@/lib/localDB";

const PAGE_SIZE = 50;

async function fetchPage(listId: string, page = 0, q?: string, isOnline?: boolean) {
  // Solo usar offline si EXPLÍCITAMENTE está offline
  if (isOnline === false) {
    // Modo offline: usar IndexedDB
    const result = await getProductsForListOffline(listId, page, PAGE_SIZE, q);
    return {
      data: result.data,
      count: result.total,
      nextPage: result.hasMore ? page + 1 : undefined,
    };
  }

  // Modo online: usar Supabase (incluye cuando isOnline es undefined)
  const from = page * PAGE_SIZE,
    to = from + PAGE_SIZE - 1;
  let query = (supabase as any)
    .from("dynamic_products_index")
    .select("product_id, list_id, code, name, price, quantity, in_my_stock, calculated_data, dynamic_products(data)", { count: "exact" })
    .eq("list_id", listId)
    .order("name", { ascending: true, nullsFirst: true })
    .range(from, to);
  if (q) query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%`);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data, count, nextPage: to + 1 < (count ?? 0) ? page + 1 : undefined };
}

export function useListProducts(listId: string, q?: string) {
  const isOnline = useOnlineStatus();

  return useInfiniteQuery({
    queryKey: ["list-products", listId, q, isOnline ? "online" : "offline"],
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchPage(listId, (pageParam as number) ?? 0, q, isOnline);
      } catch (error: any) {
        console.error("Error fetching products:", error);
        // Si falla online, intentar offline como fallback
        if (isOnline !== false) {
          console.log("Falling back to offline data");
          return await fetchPage(listId, (pageParam as number) ?? 0, q, false);
        }
        throw error;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage,
    staleTime: 30 * 1000, // 30 segundos para refrescar más frecuentemente
    retry: false,
  });
}
