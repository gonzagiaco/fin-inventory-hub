import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePendingOperations } from '@/hooks/usePendingOperations';
import { syncPendingOperations } from '@/lib/localDB';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Database, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function ConnectionBadge() {
  const isOnline = useOnlineStatus();
  const { count: pendingCount } = usePendingOperations();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Auto-sync cuando cambia el estado de pendientes
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      setIsSyncing(true);
      syncPendingOperations(queryClient)
        .then(() => {
          toast.success('Sincronización completada');
        })
        .catch((error: any) => {
          toast.error(`Error al sincronizar: ${error.message}`);
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }
  }, [isOnline, pendingCount, queryClient]);

  // Sincronizando
  if (isSyncing) {
    return (
      <div className="fixed bottom-4 left-4 safe-bottom lg:top-4 lg:safe-top lg:left-1/2 lg:-translate-x-1/2 lg:bottom-auto z-50 shadow-lg">
        <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-blue-600">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          Sincronizando...
        </Badge>
      </div>
    );
  }

  // Offline
  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 safe-bottom lg:top-4 lg:safe-top lg:left-1/2 lg:-translate-x-1/2 lg:bottom-auto z-50 shadow-lg">
        <Badge variant="destructive" className="animate-pulse">
          <WifiOff className="h-3 w-3 mr-1" />
          Offline
        </Badge>
      </div>
    );
  }

  // Online con operaciones pendientes
  if (pendingCount > 0) {
    return (
      <div className="fixed bottom-4 left-4 safe-bottom lg:top-4 lg:safe-top lg:left-1/2 lg:-translate-x-1/2 lg:bottom-auto z-50 shadow-lg">
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600">
          <Database className="h-3 w-3 mr-1" />
          {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
        </Badge>
      </div>
    );
  }

  // Online sin pendientes - no mostrar nada
  return null;
}
