import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getProductsForListOffline } from "@/lib/localDB";

const PAGE_SIZE = 50;

async function fetchPage(listId: string, page = 0, q?: string, isOnline?: boolean) {
  if (!isOnline) {
    // Modo offline: usar IndexedDB
    const result = await getProductsForListOffline(listId, page, PAGE_SIZE, q);
    return {
      data: result.data,
      count: result.total,
      nextPage: result.hasMore ? page + 1 : undefined,
    };
  }

  // Modo online: usar Supabase
  const from = page * PAGE_SIZE,
    to = from + PAGE_SIZE - 1;
  let query = (supabase as any)
    .from("dynamic_products_index")
    .select("product_id, list_id, code, name, price, quantity, dynamic_products(data)", { count: "exact" })
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
    queryFn: ({ pageParam }) => fetchPage(listId, (pageParam as number) ?? 0, q, isOnline),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage,
    staleTime: 5 * 60 * 1000,
  });
}
