import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setOnSyncCompletedCallback } from '@/lib/localDB';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      console.log('🟢 Conexión restaurada');
      setIsOnline(true);
    };
    
    const handleOffline = () => {
      console.log('🔴 Conexión perdida');
      setIsOnline(false);
    };

    // ✅ Registrar callback para invalidar queries después de sincronizar
    setOnSyncCompletedCallback(() => {
      console.log('♻️ Sincronización completada - invalidando queries...');
      queryClient.invalidateQueries({ 
        queryKey: ["product-lists"],
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ 
        queryKey: ["dynamic-products"],
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ 
        queryKey: ["product-lists-index"],
        refetchType: 'all'
      });
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      setOnSyncCompletedCallback(null);
    };
  }, [queryClient]);

  return isOnline;
}
