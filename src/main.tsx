import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Registrar Service Worker
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('Nueva versión disponible - Actualizando...');
  },
  onOfflineReady() {
    console.log('Aplicación lista para funcionar offline');
  },
  immediate: true
});

createRoot(document.getElementById("root")!).render(<App />);
