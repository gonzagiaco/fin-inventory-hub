import { useEffect, useState } from 'react';
import { searchProducts } from '@/services/searchService';

export function useSearch(term: string, limit = 10, deps: any[] = []) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = term?.trim();
      if (!q || q.length < 2) { setResults([]); return; }
      setLoading(true);
      try { setResults(await searchProducts(q, { limit })); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, limit, ...deps]);
  return { loading, results };
}
