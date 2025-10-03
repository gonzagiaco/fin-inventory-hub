import { useState, useMemo } from "react";
import Header from "@/components/Header";
import StockDialog from "@/components/StockDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Upload, QrCode, Edit, Trash2, ChevronLeft, ChevronRight, Filter, Plus } from "lucide-react";
import { toast } from "sonner";
import { StockItem, CategoryFilter, QuantityFilter } from "@/types";

const ITEMS_PER_PAGE = 5;

const Stock = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("Todas");
  const [quantityFilter, setQuantityFilter] = useState<QuantityFilter>("Cualquiera");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [stockItems, setStockItems] = useState<StockItem[]>([
    { id: "1", code: "A123", name: "Organic Apples", quantity: 150, category: "Fruits" },
    { id: "2", code: "B456", name: "Whole Wheat Bread", quantity: 80, category: "Bakery" },
    { id: "3", code: "C789", name: "Fresh Milk", quantity: 120, category: "Dairy" },
    { id: "4", code: "D012", name: "Tomatoes", quantity: 95, category: "Produce" },
    { id: "5", code: "E345", name: "Bananas", quantity: 200, category: "Fruits" },
    { id: "6", code: "F678", name: "Croissants", quantity: 45, category: "Bakery" },
  ]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

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
      }

      return matchesSearch && matchesCategory && matchesQuantity;
    });
  }, [stockItems, searchQuery, categoryFilter, quantityFilter]);

  // Paginación
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  // Resetear página cuando cambien los filtros
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, quantityFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpdateStock = () => {
    if (!selectedFile) {
      toast.error("Por favor, selecciona un archivo primero");
      return;
    }

    setIsUploading(true);

    setTimeout(() => {
      setIsUploading(false);
      toast.success("El stock se ha actualizado correctamente");
      setSelectedFile(null);
    }, 3000);
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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            {/* Filtros */}
            <div className="glassmorphism rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4 text-foreground">Filtros</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

            {/* Tabla de Stock */}
            <div className="glassmorphism rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="p-4 font-semibold text-sm text-muted-foreground">Código</th>
                      <th className="p-4 font-semibold text-sm text-muted-foreground">Nombre</th>
                      <th className="p-4 font-semibold text-sm text-muted-foreground">Cantidad</th>
                      <th className="p-4 font-semibold text-sm text-muted-foreground">Categoría</th>
                      <th className="p-4 font-semibold text-sm text-muted-foreground text-center">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {paginatedItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No se encontraron productos
                        </td>
                      </tr>
                    ) : (
                      paginatedItems.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-primary/10 transition-colors duration-300"
                        >
                          <td className="p-4 text-sm font-medium text-foreground">{item.code}</td>
                          <td className="p-4 text-sm font-medium text-foreground">{item.name}</td>
                          <td className="p-4 text-sm font-medium text-foreground">
                            {item.quantity}
                          </td>
                          <td className="p-4 text-sm">
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary/20 text-primary">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-4 text-sm font-semibold">
                            <div className="flex justify-center items-center space-x-2">
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
                      ))
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

          <div className="space-y-8">
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

            {/* Importar desde Excel */}
            <div className="glassmorphism rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-foreground">Importar desde Excel</h2>
              <div className="space-y-4">
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer w-full flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed border-primary/50 hover:bg-primary/10 transition-colors duration-300"
                >
                  <Upload className="h-10 w-10 text-primary" />
                  <span className="mt-2 text-sm text-center text-muted-foreground">
                    {selectedFile ? selectedFile.name : "Cargar Archivo Excel"}
                  </span>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {isUploading && (
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin h-9 w-9 border-4 border-primary/20 border-t-primary rounded-full" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Cargando archivo...
                    </span>
                  </div>
                )}
                <button
                  onClick={handleUpdateStock}
                  disabled={isUploading}
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex items-center justify-center"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  <span>Actualizar Stock</span>
                </button>
              </div>
            </div>

            {/* Escanear Código */}
            <div className="glassmorphism rounded-xl shadow-lg p-6 text-center">
              <h2 className="text-xl font-bold mb-4 text-foreground">Escanear Código</h2>
              <button className="w-full bg-transparent border-2 border-primary text-primary font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center justify-center hover:bg-primary/10">
                <QrCode className="mr-2 h-6 w-6" />
                <span>Escanear</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <StockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        onSave={handleSaveItem}
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
