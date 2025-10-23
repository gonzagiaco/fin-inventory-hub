import { useState, useMemo } from "react";
import { Search, Filter, FileDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RequestCart from "@/components/RequestCart";
import { RequestItem } from "@/types";
import { useAllDynamicProducts, EnrichedProduct } from "@/hooks/useAllDynamicProducts";
import { Card } from "@/components/ui/card";
import { exportOrdersBySupplier } from "@/utils/exportOrdersBySupplier";
import { SupplierStockSection } from "@/components/stock/SupplierStockSection";
import { toast } from "sonner";

export default function Stock() {
  const [searchQuery, setSearchQuery] = useState("");
  const [quantityFilter, setQuantityFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [requestList, setRequestList] = useState<RequestItem[]>([]);
  
  const { productsByList, listDetails, suppliers, isLoading } = useAllDynamicProducts();

  // Group lists by supplier and apply filters
  const supplierSections = useMemo(() => {
    const sections = new Map<string, { 
      supplierName: string; 
      supplierLogo: string | null;
      lists: Array<{
        listId: string;
        listName: string;
        supplierId: string;
        supplierName: string;
        supplierLogo: string | null;
        columnSchema: any[];
        productCount: number;
      }>;
    }>();

    // Group lists by supplier
    listDetails.forEach((list) => {
      if (!sections.has(list.supplierId)) {
        sections.set(list.supplierId, {
          supplierName: list.supplierName,
          supplierLogo: list.supplierLogo,
          lists: [],
        });
      }
      sections.get(list.supplierId)!.lists.push(list);
    });

    return sections;
  }, [listDetails]);

  // Apply filters to products in each list
  const filteredProductsByList = useMemo(() => {
    const filtered = new Map<string, EnrichedProduct[]>();

    productsByList.forEach((products, listId) => {
      const filteredProducts = products.filter((item) => {
        // Search filter (applies across all lists)
        const matchesSearch =
          !searchQuery ||
          item.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name?.toLowerCase().includes(searchQuery.toLowerCase());

        // Quantity filter (applies across all lists)
        const quantity = item.quantity || 0;
        const matchesQuantity =
          quantityFilter === "all" ||
          (quantityFilter === "low" && quantity < 50) ||
          (quantityFilter === "medium" && quantity >= 50 && quantity < 100) ||
          (quantityFilter === "high" && quantity >= 100);

        return matchesSearch && matchesQuantity;
      });

      filtered.set(listId, filteredProducts);
    });

    return filtered;
  }, [productsByList, searchQuery, quantityFilter]);

  // Filter suppliers based on supplier filter
  const visibleSupplierSections = useMemo(() => {
    if (supplierFilter === "all") {
      return Array.from(supplierSections.entries());
    }
    
    return Array.from(supplierSections.entries()).filter(
      ([supplierId]) => supplierId === supplierFilter
    );
  }, [supplierSections, supplierFilter]);

  // Calculate total filtered products
  const totalFilteredProducts = useMemo(() => {
    let count = 0;
    visibleSupplierSections.forEach(([_, section]) => {
      section.lists.forEach((list) => {
        const products = filteredProductsByList.get(list.listId) || [];
        count += products.length;
      });
    });
    return count;
  }, [visibleSupplierSections, filteredProductsByList]);

  const handleAddToRequest = (product: EnrichedProduct) => {
    const existingItem = requestList.find((r) => r.productId === product.id);
    
    if (existingItem) {
      setRequestList((prev) =>
        prev.map((r) =>
          r.productId === product.id ? { ...r, quantity: r.quantity + 1 } : r
        )
      );
      toast.success("Cantidad actualizada en la lista de pedidos");
    } else {
      const newRequest: RequestItem = {
        id: Date.now().toString(),
        productId: product.id,
        code: product.code || "",
        name: product.name || "",
        supplierId: product.supplierId,
        costPrice: product.price || 0,
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

    exportOrdersBySupplier(requestList, suppliers);
    
    const uniqueSuppliers = new Set(requestList.map(item => item.supplierId)).size;
    
    toast.success("Pedidos exportados", {
      description: `Se generaron ${uniqueSuppliers} archivo${uniqueSuppliers > 1 ? 's' : ''} (uno por proveedor)`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-6">Stock de Productos</h1>
          
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por código o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select value={quantityFilter} onValueChange={setQuantityFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Cantidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cantidades</SelectItem>
                  <SelectItem value="low">Bajo stock (&lt; 50)</SelectItem>
                  <SelectItem value="medium">Stock medio (50-100)</SelectItem>
                  <SelectItem value="high">Stock alto (&gt; 100)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={handleExportToExcel}
                disabled={requestList.length === 0}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Exportar Pedido
              </Button>
            </div>
          </div>

          {/* Results summary */}
          <div className="text-sm text-muted-foreground">
            Mostrando {totalFilteredProducts} productos en {visibleSupplierSections.length}{" "}
            {visibleSupplierSections.length === 1 ? "proveedor" : "proveedores"}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Cargando productos...</p>
              </div>
            ) : visibleSupplierSections.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No se encontraron productos</p>
              </Card>
            ) : (
              <div className="space-y-6">
                {visibleSupplierSections.map(([supplierId, section]) => (
                  <SupplierStockSection
                    key={supplierId}
                    supplierName={section.supplierName}
                    supplierLogo={section.supplierLogo}
                    lists={section.lists}
                    productsByList={filteredProductsByList}
                    onAddToRequest={handleAddToRequest}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Request Cart - Sidebar */}
          <div className="hidden xl:block w-96">
            <div className="sticky top-24">
              <RequestCart
                requests={requestList}
                onUpdateQuantity={handleUpdateRequestQuantity}
                onRemove={handleRemoveFromRequest}
                onExport={handleExportToExcel}
                suppliers={suppliers}
              />
            </div>
          </div>
        </div>

        {/* Mobile Request Cart */}
        <div className="xl:hidden mt-6">
          <RequestCart
            requests={requestList}
            onUpdateQuantity={handleUpdateRequestQuantity}
            onRemove={handleRemoveFromRequest}
            onExport={handleExportToExcel}
            suppliers={suppliers}
          />
        </div>
      </div>
    </div>
  );
}
