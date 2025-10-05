import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Stock from "./pages/Stock";
import ClientesDeudores from "./pages/ClientesDeudores";
import Proveedores from "./pages/Proveedores";
import Ayuda from "./pages/Ayuda";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full">
                    <Sidebar />
                    <Stock />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/clientes-deudores"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full">
                    <Sidebar />
                    <ClientesDeudores />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/proveedores"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full">
                    <Sidebar />
                    <Proveedores />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ayuda"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full">
                    <Sidebar />
                    <Ayuda />
                  </div>
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
