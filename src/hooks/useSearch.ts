import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSearch(query: string, limit = 10) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any).rpc('search_products', {
          p_query: query,
          p_limit: limit,
        });

        if (error) throw error;
        setResults(data ?? []);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, limit]);

  return { results, loading };
}
