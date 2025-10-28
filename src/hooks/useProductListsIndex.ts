import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useProductListsIndex() {
  return useQuery({
    queryKey: ['product-lists-index'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_lists')
        .select('id, name, supplier_id, mapping_config, product_count, column_schema, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
