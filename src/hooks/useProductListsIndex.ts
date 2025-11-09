import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';
import { getOfflineData } from '@/lib/localDB';

export function useProductListsIndex() {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: ['product-lists-index', isOnline ? 'online' : 'offline'],
    queryFn: async () => {
      // Solo usar offline si EXPLÍCITAMENTE está offline
      if (isOnline === false) {
        const offlineData = await getOfflineData('product_lists') as any[];
        return (offlineData || []).map(list => ({
          id: list.id,
          name: list.name,
          supplier_id: list.supplier_id,
          mapping_config: list.mapping_config,
          product_count: list.product_count,
          column_schema: list.column_schema,
          created_at: list.created_at,
        }));
      }

      // Modo online
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
