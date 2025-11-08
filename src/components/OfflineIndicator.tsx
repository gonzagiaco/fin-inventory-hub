import { useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePendingOperations } from '@/hooks/usePendingOperations';
import { syncPendingOperations } from '@/lib/localDB';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WifiOff, Wifi, RefreshCw, Database } from 'lucide-react';
import { toast } from 'sonner';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { count: pendingCount } = usePendingOperations();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.error('No hay conexión a internet');
      return;
    }

    setIsSyncing(true);
    try {
      await syncPendingOperations();
      toast.success('Sincronización completada');
    } catch (error: any) {
      toast.error(`Error al sincronizar: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // No mostrar nada si está online y no hay operaciones pendientes
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-5">
      <div className="container max-w-screen-xl mx-auto">
        <Alert
          variant={isOnline ? 'default' : 'destructive'}
          className="shadow-lg border-2 backdrop-blur-sm bg-background/95"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <WifiOff className="h-5 w-5 shrink-0" />
              )}
              
              <div className="flex-1 min-w-0">
                <AlertDescription className="font-medium">
                  {isOnline ? (
                    <span className="text-green-600">Conectado</span>
                  ) : (
                    <span>Sin conexión</span>
                  )}
                  {pendingCount > 0 && (
                    <span className="ml-2">
                      • {pendingCount} {pendingCount === 1 ? 'operación pendiente' : 'operaciones pendientes'}
                    </span>
                  )}
                </AlertDescription>
                
                {!isOnline && (
                  <AlertDescription className="text-sm text-muted-foreground mt-1">
                    Los cambios se sincronizarán automáticamente al reconectar
                  </AlertDescription>
                )}
              </div>
            </div>

            {isOnline && pendingCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="shrink-0"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Sincronizar ahora
                  </>
                )}
              </Button>
            )}
          </div>
        </Alert>
      </div>
    </div>
  );
}
