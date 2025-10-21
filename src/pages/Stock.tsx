import { useState, useMemo } from "react";
import Header from "@/components/Header";
import StockDialog from "@/components/StockDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import RequestCart from "@/components/RequestCart";
import { Upload, QrCode, Edit, Trash2, ChevronLeft, ChevronRight, Filter, Plus, RefreshCw, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { StockItem, CategoryFilter, QuantityFilter, RequestItem, Supplier } from "@/types";
import * as XLSX from "xlsx";
import { importProductsFromExcel } from "@/utils/importExcel";
import { exportOrdersBySupplier } from "@/utils/exportOrdersBySupplier";

const ITEMS_PER_PAGE = 5;

const Stock = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("Todas");
  const [quantityFilter, setQuantityFilter] = useState<QuantityFilter>("Cualquiera");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Mock suppliers list
  const [suppliers] = useState<Supplier[]>([
    { id: "1", name: "Fresh Farms", logo: "" },
    { id: "2", name: "Bakery Co", logo: "" },
    { id: "3", name: "Dairy Express", logo: "" },
    { id: "4", name: "Farm Direct", logo: "" },
    { id: "5", name: "Tropical Imports", logo: "" },
  ]);

  const [stockItems, setStockItems] = useState<StockItem[]>([
    { id: "1", code: "A123", name: "Organic Apples", quantity: 150, category: "Fruits", costPrice: 25.50, supplierId: "1", specialDiscount: false, minStockLimit: 100 },
    { id: "2", code: "B456", name: "Whole Wheat Bread", quantity: 80, category: "Bakery", costPrice: 15.00, supplierId: "2", specialDiscount: true, minStockLimit: 50 },
    { id: "3", code: "C789", name: "Fresh Milk", quantity: 120, category: "Dairy", costPrice: 12.00, supplierId: "3", specialDiscount: false, minStockLimit: 100 },
    { id: "4", code: "D012", name: "Tomatoes", quantity: 95, category: "Produce", costPrice: 8.50, supplierId: "4", specialDiscount: true, minStockLimit: 80 },
    { id: "5", code: "E345", name: "Bananas", quantity: 200, category: "Fruits", costPrice: 18.00, supplierId: "5", specialDiscount: false, minStockLimit: 150 },
    { id: "6", code: "F678", name: "Croissants", quantity: 45, category: "Bakery", costPrice: 20.00, supplierId: "2", specialDiscount: false, minStockLimit: 60 },
  ]);

  const [requestList, setRequestList] = useState<RequestItem[]>([]);
  const [isUpdatingFromSupplier, setIsUpdatingFromSupplier] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Helper function to get supplier name
  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name || "Unknown";
  };

  // Filtrado y búsqueda
  const filteredItems = useMemo(() => {
    return stockItems.filter((item) => {
      // Búsqueda
      const matchesSearch =
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Filtro de categoría
      const matchesCategory =
        categoryFilter === "Todas" || item.category === categoryFilter;

      // Filtro de cantidad
      let matchesQuantity = true;
      if (quantityFilter === "< 100") {
        matchesQuantity = item.quantity < 100;
      } else if (quantityFilter === "100 - 200") {
        matchesQuantity = item.quantity >= 100 && item.quantity <= 200;
      } else if (quantityFilter === "> 200") {
        matchesQuantity = item.quantity > 200;
      } else if (quantityFilter === "Bajo Stock") {
        matchesQuantity = item.quantity <= item.minStockLimit;
      }

      // Filtro de proveedor
      const matchesSupplier =
        supplierFilter === "all" || item.supplierId === supplierFilter;

      return matchesSearch && matchesCategory && matchesQuantity && matchesSupplier;
    });
  }, [stockItems, searchQuery, categoryFilter, quantityFilter, supplierFilter]);

  // Paginación
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  // Resetear página cuando cambien los filtros
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, quantityFilter, supplierFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedFile) {
      toast.error("Por favor, selecciona un archivo primero");
      return;
    }

    if (supplierFilter === "all") {
      toast.error("Selecciona un proveedor", {
        description: "Por favor selecciona un proveedor antes de importar productos.",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Filter current products by selected supplier
      const currentProducts = stockItems.filter(
        (item) => item.supplierId === supplierFilter
      );

      const { importedProducts, newCount, updateCount } = await importProductsFromExcel(
        selectedFile,
        currentProducts,
        supplierFilter
      );

      if (importedProducts.length === 0) {
        toast.error("Error en importación", {
          description: "No se encontraron productos válidos en el archivo. Asegúrate de que tenga columnas: code, name/description, price.",
        });
        return;
      }

      // Merge imported products into stock items
      setStockItems((prev) => {
        const updatedItems = [...prev];
        
        importedProducts.forEach((importedProduct) => {
          const existingIndex = updatedItems.findIndex(
            (item) => item.id === importedProduct.id || 
            (item.code === importedProduct.code && item.supplierId === importedProduct.supplierId)
          );

          if (existingIndex !== -1) {
            // Update existing product
            updatedItems[existingIndex] = importedProduct;
          } else {
            // Add new product
            updatedItems.push(importedProduct);
          }
        });

        return updatedItems;
      });

      toast.success("Importación exitosa", {
        description: `${newCount} productos nuevos agregados, ${updateCount} productos actualizados.`,
      });

      setSelectedFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      console.error("Error importing file:", error);
      toast.error("Error", {
        description: error instanceof Error ? error.message : "No se pudo procesar el archivo Excel.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveItem = (item: Omit<StockItem, "id"> & { id?: string }) => {
    if (item.id) {
      // Editar
      setStockItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...item, id: item.id } : i))
      );
      toast.success("Producto actualizado correctamente");
    } else {
      // Crear
      const newItem: StockItem = {
        ...item,
        id: Date.now().toString(),
      };
      setStockItems((prev) => [...prev, newItem]);
      toast.success("Producto creado correctamente");
    }
    setEditingItem(null);
  };

  const handleDeleteItem = (id: string) => {
    setDeletingItemId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingItemId) {
      setStockItems((prev) => prev.filter((item) => item.id !== deletingItemId));
      toast.success("Producto eliminado correctamente");
      setDeletingItemId(null);
    }
  };

  const handleEditItem = (item: StockItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const applyFilters = () => {
    toast.success("Filtros aplicados");
  };

  const handleUpdateFromSupplier = () => {
    setIsUpdatingFromSupplier(true);
    
    setTimeout(() => {
      setStockItems((prev) =>
        prev.map((item) => ({
          ...item,
          quantity: item.quantity + Math.floor(Math.random() * 20 - 5),
          costPrice: item.costPrice + (Math.random() * 4 - 2),
        }))
      );
      setIsUpdatingFromSupplier(false);
      toast.success("Datos actualizados desde proveedores");
    }, 2000);
  };

  const handleAddToRequest = (item: StockItem) => {
    const existingItem = requestList.find((r) => r.productId === item.id);
    
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
        code: item.code,
        name: item.name,
        supplierId: item.supplierId,
        costPrice: item.costPrice,
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

  const calculatePublicPrice = (item: StockItem) => {
    if (item.specialDiscount) {
      return (item.costPrice * 0.92) * 2;
    }
    return item.costPrice * 2;
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
        {/* Contenedores superiores - Solo en desktop (Import container removed) */}
        <div className="hidden xl:grid xl:grid-cols-2 gap-8 mb-8">
          {/* Lista de Pedidos */}
          <RequestCart
            requests={requestList}
            onUpdateQuantity={handleUpdateRequestQuantity}
            onRemove={handleRemoveFromRequest}
            onExport={handleExportToExcel}
            suppliers={suppliers}
          />

          {/* Botón Nuevo Producto */}
          <div className="glassmorphism rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-foreground">Gestionar Productos</h2>
            <button
              onClick={() => {
                setEditingItem(null);
                setDialogOpen(true);
              }}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex items-center justify-center"
            >
              <Plus className="mr-2 h-5 w-5" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </div>

        {/* Filtros y Tabla - Ancho completo */}
        <div>
          {/* Filtros y Actualizar desde Proveedor */}
          <div className="glassmorphism rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Filtros</h2>
              <button
                onClick={handleUpdateFromSupplier}
                disabled={isUpdatingFromSupplier}
                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold py-2 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isUpdatingFromSupplier ? "animate-spin" : ""}`} />
                <span>Actualizar desde Proveedores</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Categoría
                </label>
                <select
                  className="w-full rounded-lg border-transparent bg-muted/50 backdrop-blur-sm py-3 px-4 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 shadow-sm appearance-none"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                >
                  <option>Todas</option>
                  <option>Fruits</option>
                  <option>Bakery</option>
                  <option>Dairy</option>
                  <option>Produce</option>
                </select>
              </div>
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
              {paginatedItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No se encontraron productos
                </div>
              ) : (
                paginatedItems.map((item) => {
                  const isLowStock = item.quantity < item.minStockLimit;
                  const publicPrice = calculatePublicPrice(item);
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border ${isLowStock ? "border-red-500 bg-red-500/10" : "border-primary/20"}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-foreground">{item.code}</p>
                          <p className="text-sm text-foreground">{item.name}</p>
                          {item.specialDiscount && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500/20 text-green-500">
                              -8%
                            </span>
                          )}
                        </div>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary/20 text-primary">
                          {item.category}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm mb-3">
                        <p className="text-muted-foreground">Proveedor: <span className="text-foreground">{getSupplierName(item.supplierId)}</span></p>
                        <p className={isLowStock ? "text-red-500 font-bold" : "text-muted-foreground"}>
                          Stock: <span className="text-foreground">{item.quantity}</span> / Mín: {item.minStockLimit}
                          {isLowStock && <span className="ml-2 text-xs">(Bajo stock)</span>}
                        </p>
                        <p className="text-muted-foreground">Costo: <span className="text-foreground">${item.costPrice.toFixed(2)}</span></p>
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
                        <button
                          onClick={() => handleEditItem(item)}
                          className="flex-1 p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors text-sm font-medium"
                        >
                          <Edit className="h-4 w-4 inline mr-1" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
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
                    <th className="p-4 font-semibold text-sm text-muted-foreground">Stock Mín</th>
                    <th className="p-4 font-semibold text-sm text-muted-foreground">Precio Costo</th>
                    <th className="p-4 font-semibold text-sm text-muted-foreground">Precio Público</th>
                    <th className="p-4 font-semibold text-sm text-muted-foreground hidden xl:table-cell">Categoría</th>
                    <th className="p-4 font-semibold text-sm text-muted-foreground text-center">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        No se encontraron productos
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => {
                      const isLowStock = item.quantity < item.minStockLimit;
                      const publicPrice = calculatePublicPrice(item);
                      
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-primary/10 transition-colors duration-300 ${isLowStock ? "bg-red-500/10" : ""}`}
                        >
                          <td className="p-4 text-sm font-medium text-foreground">{item.code}</td>
                          <td className="p-4 text-sm font-medium text-foreground">
                            {item.name}
                            {item.specialDiscount && (
                              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500/20 text-green-500">
                                -8%
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-sm font-medium text-foreground hidden lg:table-cell">{getSupplierName(item.supplierId)}</td>
                          <td className={`p-4 text-sm font-medium ${isLowStock ? "text-red-500 font-bold" : "text-foreground"}`}>
                            {item.quantity}
                            {isLowStock && (
                              <span className="ml-2 text-xs">(Bajo stock)</span>
                            )}
                          </td>
                          <td className="p-4 text-sm font-medium text-muted-foreground">{item.minStockLimit}</td>
                          <td className="p-4 text-sm font-medium text-foreground">${item.costPrice.toFixed(2)}</td>
                          <td className="p-4 text-sm font-medium text-primary font-bold">${publicPrice.toFixed(2)}</td>
                          <td className="p-4 text-sm hidden xl:table-cell">
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary/20 text-primary">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-4 text-sm font-semibold">
                            <div className="flex justify-center items-center space-x-2">
                              <button
                                onClick={() => handleAddToRequest(item)}
                                className="p-2 rounded-full hover:bg-green-500/20 transition-colors duration-300 text-green-500"
                                title="Solicitar a Proveedor"
                              >
                                <ShoppingCart className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleEditItem(item)}
                                className="p-2 rounded-full hover:bg-primary/20 transition-colors duration-300 text-primary"
                              >
                                <Edit className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-2 rounded-full hover:bg-red-500/20 transition-colors duration-300 text-red-500"
                              >
                                <Trash2 className="h-5 w-5" />
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

          {/* Botón Nuevo Producto */}
          <div className="glassmorphism rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-foreground">Gestionar Productos</h2>
            <button
              onClick={() => {
                setEditingItem(null);
                setDialogOpen(true);
              }}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex items-center justify-center"
            >
              <Plus className="mr-2 h-5 w-5" />
              <span>Nuevo Producto</span>
            </button>
          </div>

        </div>
      </main>

      <StockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        onSave={handleSaveItem}
        suppliers={suppliers}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="¿Eliminar producto?"
        description="Esta acción no se puede deshacer. El producto será eliminado permanentemente del inventario."
      />
    </div>
  );
};

export default Stock;
