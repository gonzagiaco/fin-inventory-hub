import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import CollapsibleSidebar from "./components/CollapsibleSidebar";
import Stock from "./pages/Stock";
import Proveedores from "./pages/Proveedores";
import Remitos from "./pages/Remitos";
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
                    <CollapsibleSidebar />
                    <Stock />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/remitos"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full">
                    <CollapsibleSidebar />
                    <Remitos />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/proveedores"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full">
                    <CollapsibleSidebar />
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
                    <CollapsibleSidebar />
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
