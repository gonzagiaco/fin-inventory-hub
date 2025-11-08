import { useState, useEffect } from 'react';
import { localDB } from '@/lib/localDB';

export function usePendingOperations() {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const updateCount = async () => {
      try {
        const operations = await localDB.pending_operations.count();
        if (mounted) {
          setCount(operations);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error al obtener operaciones pendientes:', error);
        if (mounted) {
          setCount(0);
          setIsLoading(false);
        }
      }
    };

    // Actualizar inmediatamente
    updateCount();

    // Actualizar cada 3 segundos
    const interval = setInterval(updateCount, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { count, isLoading };
}
