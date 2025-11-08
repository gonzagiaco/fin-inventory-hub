import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePendingOperations } from '@/hooks/usePendingOperations';
import { syncPendingOperations } from '@/lib/localDB';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Database, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function ConnectionBadge() {
  const isOnline = useOnlineStatus();
  const { count: pendingCount } = usePendingOperations();
  const [isSyncing, setIsSyncing] = useState(false);

  // Auto-sync cuando cambia el estado de pendientes
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      setIsSyncing(true);
      syncPendingOperations()
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
  }, [isOnline, pendingCount]);

  // Sincronizando
  if (isSyncing) {
    return (
      <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-blue-600">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        Sincronizando...
      </Badge>
    );
  }

  // Offline
  if (!isOnline) {
    return (
      <Badge variant="destructive" className="animate-pulse">
        <WifiOff className="h-3 w-3 mr-1" />
        Offline
      </Badge>
    );
  }

  // Online con operaciones pendientes
  if (pendingCount > 0) {
    return (
      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600">
        <Database className="h-3 w-3 mr-1" />
        {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
      </Badge>
    );
  }

  // Online sin pendientes - no mostrar nada
  return null;
}
