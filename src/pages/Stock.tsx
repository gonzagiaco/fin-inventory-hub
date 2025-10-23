import { useState, useMemo } from "react";
import Header from "@/components/Header";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import RequestCart from "@/components/RequestCart";
import { ChevronLeft, ChevronRight, Filter, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { QuantityFilter, RequestItem } from "@/types";
import { exportOrdersBySupplier } from "@/utils/exportOrdersBySupplier";
import { useAllDynamicProducts, EnrichedProduct } from "@/hooks/useAllDynamicProducts";

const ITEMS_PER_PAGE = 5;

const Stock = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [quantityFilter, setQuantityFilter] = useState<QuantityFilter>("Cualquiera");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Use Supabase hook for data
  const { allProducts, suppliers, isLoading } = useAllDynamicProducts();

  const [requestList, setRequestList] = useState<RequestItem[]>([]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Helper function to get supplier name
  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name || "Unknown";
  };

  // Filtrado y búsqueda
  const filteredItems = useMemo(() => {
    return allProducts.filter((item) => {
      // Búsqueda
      const matchesSearch =
        (item.code?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (item.name?.toLowerCase() || "").includes(searchQuery.toLowerCase());

      // Filtro de cantidad
      let matchesQuantity = true;
      const quantity = item.quantity || 0;
      if (quantityFilter === "< 100") {
        matchesQuantity = quantity < 100;
      } else if (quantityFilter === "100 - 200") {
        matchesQuantity = quantity >= 100 && quantity <= 200;
      } else if (quantityFilter === "> 200") {
        matchesQuantity = quantity > 200;
      } else if (quantityFilter === "Bajo Stock") {
        // For dynamic products, we don't have minStockLimit, so use a default threshold
        matchesQuantity = quantity < 50;
      }

      // Filtro de proveedor - need to find supplier from product's listId
      const matchesSupplier =
        supplierFilter === "all" || 
        suppliers.some(s => s.id === supplierFilter && s.name === item.supplierName);

      return matchesSearch && matchesQuantity && matchesSupplier;
    });
  }, [allProducts, searchQuery, quantityFilter, supplierFilter, suppliers]);

  // Paginación
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  // Resetear página cuando cambien los filtros
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, quantityFilter, supplierFilter]);


  const applyFilters = () => {
    toast.success("Filtros aplicados");
  };

  const handleAddToRequest = (item: EnrichedProduct) => {
    const existingItem = requestList.find((r) => r.productId === item.id);
    
    // Find supplier ID from suppliers array
    const supplier = suppliers.find(s => s.name === item.supplierName);
    const supplierId = supplier?.id || "";
    
    if (existingItem) {
      setRequestList((prev) =>
        prev.map((r) =>
          r.productId === item.id ? { ...r, quantity: r.quantity + 1 } : r
        )
      );
      toast.success("Cantidad actualizada en la lista de pedidos");
    } else {
      const newRequest: RequestItem = {
        id: Date.now().toString(),
        productId: item.id,
        code: item.code || "",
        name: item.name || "",
        supplierId: supplierId,
        costPrice: item.price || 0,
        quantity: 1,
      };
      setRequestList((prev) => [...prev, newRequest]);
      toast.success("Producto agregado a la lista de pedidos");
    }
  };

  const handleUpdateRequestQuantity = (id: string, quantity: number) => {
    setRequestList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const handleRemoveFromRequest = (id: string) => {
    setRequestList((prev) => prev.filter((item) => item.id !== id));
    toast.success("Producto eliminado de la lista de pedidos");
  };

  const handleExportToExcel = () => {
    if (requestList.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }

    // Export one file per supplier
    exportOrdersBySupplier(requestList, suppliers);
    
    // Count unique suppliers
    const uniqueSuppliers = new Set(requestList.map(item => item.supplierId)).size;
    
    toast.success("Pedidos exportados", {
      description: `Se generaron ${uniqueSuppliers} archivo${uniqueSuppliers > 1 ? 's' : ''} (uno por proveedor)`,
    });
  };

  const calculatePublicPrice = (item: EnrichedProduct) => {
    const price = item.price || 0;
    // Since we don't have specialDiscount info, use standard calculation
    return price * 2;
  };

  return (
    <div className="flex-1 p-6 lg:p-10">
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Stock</h1>
          </div>

          <div className="relative flex-1 max-w-lg">
            <input
              className="w-full rounded-lg border-transparent bg-muted/50 backdrop-blur-sm py-3 px-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 shadow-sm"
              placeholder="Buscar por código, nombre..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <main>
        {/* Contenedores superiores - Solo en desktop */}
        <div className="hidden xl:grid xl:grid-cols-1 gap-8 mb-8">
          {/* Lista de Pedidos */}
          <RequestCart
            requests={requestList}
            onUpdateQuantity={handleUpdateRequestQuantity}
            onRemove={handleRemoveFromRequest}
            onExport={handleExportToExcel}
            suppliers={suppliers}
          />
        </div>

        {/* Filtros - Ancho completo */}
        <div>
          {/* Filtros */}
          <div className="glassmorphism rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Filtros</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Cantidad
                </label>
                <select
                  className="w-full rounded-lg border-transparent bg-muted/50 backdrop-blur-sm py-3 px-4 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 shadow-sm appearance-none"
                  value={quantityFilter}
                  onChange={(e) => setQuantityFilter(e.target.value as QuantityFilter)}
                >
                  <option>Cualquiera</option>
                  <option>&lt; 100</option>
                  <option>100 - 200</option>
                  <option>&gt; 200</option>
                  <option>Bajo Stock</option>
                </select>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Proveedor
                </label>
                <select
                  className="w-full rounded-lg border-transparent bg-muted/50 backdrop-blur-sm py-3 px-4 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 shadow-sm appearance-none"
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                >
                  <option value="all">Todos los Proveedores</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={applyFilters}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex items-center justify-center"
                >
                  <Filter className="mr-2 h-5 w-5" />
                  <span>Aplicar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de Stock - Responsive */}
          <div className="glassmorphism rounded-xl shadow-lg overflow-hidden">
            {/* Mobile view - Cards */}
            <div className="md:hidden space-y-4 p-4">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Cargando productos...
                </div>
              ) : paginatedItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No se encontraron productos. Importa productos desde la página de Proveedores.
                </div>
              ) : (
                paginatedItems.map((item) => {
                  const isLowStock = (item.quantity || 0) < 50; // Default threshold
                  const publicPrice = calculatePublicPrice(item);
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border ${isLowStock ? "border-red-500 bg-red-500/10" : "border-primary/20"}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-foreground">{item.code || "N/A"}</p>
                          <p className="text-sm text-foreground">{item.name || "N/A"}</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm mb-3">
                        <p className="text-muted-foreground">Proveedor: <span className="text-foreground">{item.supplierName}</span></p>
                        <p className={isLowStock ? "text-red-500 font-bold" : "text-muted-foreground"}>
                          Stock: <span className="text-foreground">{item.quantity || 0}</span>
                          {isLowStock && <span className="ml-2 text-xs">(Bajo stock)</span>}
                        </p>
                        <p className="text-muted-foreground">Precio: <span className="text-foreground">${(item.price || 0).toFixed(2)}</span></p>
                        <p className="text-muted-foreground">Público: <span className="text-primary font-bold">${publicPrice.toFixed(2)}</span></p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddToRequest(item)}
                          className="flex-1 p-2 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors text-sm font-medium"
                        >
                          <ShoppingCart className="h-4 w-4 inline mr-1" />
                          Solicitar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop view - Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-4 font-semibold text-sm text-muted-foreground">Código</th>
                    <th className="p-4 font-semibold text-sm text-muted-foreground">Nombre</th>
                    <th className="p-4 font-semibold text-sm text-muted-foreground hidden lg:table-cell">Proveedor</th>
                    <th className="p-4 font-semibold text-sm text-muted-foreground">Cantidad</th>
                    <th className="p-4 font-semibold text-sm text-muted-foreground">Precio</th>
                    <th className="p-4 font-semibold text-sm text-muted-foreground">Precio Público</th>
                    <th className="p-4 font-semibold text-sm text-muted-foreground text-center">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        Cargando productos...
                      </td>
                    </tr>
                  ) : paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No se encontraron productos. Importa productos desde la página de Proveedores.
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => {
                      const isLowStock = (item.quantity || 0) < 50;
                      const publicPrice = calculatePublicPrice(item);
                      
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-primary/10 transition-colors duration-300 ${isLowStock ? "bg-red-500/10" : ""}`}
                        >
                          <td className="p-4 text-sm font-medium text-foreground">{item.code || "N/A"}</td>
                          <td className="p-4 text-sm font-medium text-foreground">
                            {item.name || "N/A"}
                          </td>
                          <td className="p-4 text-sm font-medium text-foreground hidden lg:table-cell">{item.supplierName}</td>
                          <td className={`p-4 text-sm font-medium ${isLowStock ? "text-red-500 font-bold" : "text-foreground"}`}>
                            {item.quantity || 0}
                            {isLowStock && (
                              <span className="ml-2 text-xs">(Bajo stock)</span>
                            )}
                          </td>
                          <td className="p-4 text-sm font-medium text-foreground">${(item.price || 0).toFixed(2)}</td>
                          <td className="p-4 text-sm font-medium text-primary font-bold">${publicPrice.toFixed(2)}</td>
                          <td className="p-4 text-sm font-semibold">
                            <div className="flex justify-center items-center space-x-2">
                              <button
                                onClick={() => handleAddToRequest(item)}
                                className="p-2 rounded-full hover:bg-green-500/20 transition-colors duration-300 text-green-500"
                                title="Solicitar a Proveedor"
                              >
                                <ShoppingCart className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex items-center justify-between border-t border-white/10">
              <span className="text-sm text-muted-foreground">
                Mostrando {paginatedItems.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}-
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} de{" "}
                {filteredItems.length} resultados
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-md hover:bg-primary/10 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`p-2 px-4 rounded-md font-bold transition-colors ${
                      currentPage === page
                        ? "bg-primary/20 text-primary"
                        : "hover:bg-primary/10 text-muted-foreground"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 rounded-md hover:bg-primary/10 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Contenedores inferiores - Solo en tablet y mobile */}
        <div className="xl:hidden space-y-8 mt-8">
          {/* Lista de Pedidos */}
          <RequestCart
            requests={requestList}
            onUpdateQuantity={handleUpdateRequestQuantity}
            onRemove={handleRemoveFromRequest}
            onExport={handleExportToExcel}
            suppliers={suppliers}
          />
        </div>
      </main>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => setDeleteDialogOpen(false)}
        title="Eliminar producto"
        description="Esta funcionalidad estará disponible próximamente."
      />
    </div>
  );
};

export default Stock;
