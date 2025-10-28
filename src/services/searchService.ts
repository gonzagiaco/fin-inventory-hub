import { supabase } from '@/integrations/supabase/client';

export async function searchProducts(term: string, opts?: { limit?: number; offset?: number; listId?: string; supplierId?: string }) {
  const { limit = 10, offset = 0, listId, supplierId } = opts ?? {};
  const { data, error } = await (supabase.rpc as any)('search_products', {
    p_term: term, p_limit: limit, p_offset: offset,
    p_list_id: listId ?? null, p_supplier_id: supplierId ?? null,
  });
  if (error) throw error;
  return data ?? [];
}
