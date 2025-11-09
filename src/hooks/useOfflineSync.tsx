import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnlineStatus } from './useOnlineStatus';
import { syncFromSupabase, syncPendingOperations } from '@/lib/localDB';
import { toast } from 'sonner';

export function useOfflineSync() {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    console.log(`🔄 Estado de conexión: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    // Invalidar todas las queries para forzar re-fetch con nueva estrategia
    queryClient.invalidateQueries();

    if (isOnline) {
      // Reconexión: sincronizar automáticamente
      const syncData = async () => {
        try {
          await syncPendingOperations();
          await syncFromSupabase();
          toast.success('Datos sincronizados correctamente');
        } catch (error) {
          console.error('Error al sincronizar:', error);
          toast.error('Error al sincronizar datos');
        }
      };
      
      setTimeout(syncData, 500);
    } else {
      toast.info('Trabajando offline. Los datos locales están disponibles.');
    }
  }, [isOnline, queryClient]);
}
