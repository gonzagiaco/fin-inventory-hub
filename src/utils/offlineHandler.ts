// Simple handler para recargar la app cuando se pierde conexión
let hasReloadedForOffline = false;

export function setupOfflineHandler() {
  window.addEventListener('offline', () => {
    console.log('🔴 Conexión perdida - recargando aplicación...');
    
    // Evitar recargas múltiples
    if (!hasReloadedForOffline) {
      hasReloadedForOffline = true;
      
      // Dar tiempo para que el evento se registre
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  });

  window.addEventListener('online', () => {
    console.log('🟢 Conexión restaurada');
    // Resetear flag para permitir recarga en próximo offline
    hasReloadedForOffline = false;
  });
}
