import { useState, useMemo } from "react";
import { Filter, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RequestCart from "@/components/RequestCart";
import { RequestItem } from "@/types";
import { Card } from "@/components/ui/card";
import { exportOrdersBySupplier } from "@/utils/exportOrdersBySupplier";
import { SupplierStockSection } from "@/components/stock/SupplierStockSection";
import { toast } from "sonner";
import { useProductListsIndex } from "@/hooks/useProductListsIndex";
import { useSuppliers } from "@/hooks/useSuppliers";

export default function Stock() {
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [requestList, setRequestList] = useState<RequestItem[]>([]);
  const [isCartCollapsed, setIsCartCollapsed] = useState(true);

  const { data: lists = [], isLoading: isLoadingLists } = useProductListsIndex();
  const { suppliers = [], isLoading: isLoadingSuppliers } = useSuppliers();
  
  const isLoading = isLoadingLists || isLoadingSuppliers;

  const supplierSections = useMemo(() => {
    const sections = new Map<
      string,
      {
        supplierName: string;
        supplierLogo: string | null;
        lists: Array<{
          id: string;
          name: string;
          supplierId: string;
          mappingConfig: any;
          productCount: number;
        }>;
      }
    >();

    lists.forEach((list: any) => {
      const supplier = suppliers.find(s => s.id === list.supplier_id);
      if (!supplier) return;
      
      if (!sections.has(list.supplier_id)) {
        sections.set(list.supplier_id, {
          supplierName: supplier.name,
          supplierLogo: supplier.logo,
          lists: [],
        });
      }
      
      sections.get(list.supplier_id)!.lists.push({
        id: list.id,
        name: list.name,
        supplierId: list.supplier_id,
        mappingConfig: list.mapping_config,
        productCount: list.product_count,
      });
    });

    return sections;
  }, [lists, suppliers]);

  const visibleSupplierSections = useMemo(() => {
    if (supplierFilter === "all") {
      return Array.from(supplierSections.entries());
    }
    return Array.from(supplierSections.entries()).filter(([supplierId]) => supplierId === supplierFilter);
  }, [supplierSections, supplierFilter]);

  const totalProducts = useMemo(() => {
    return lists.reduce((sum, list: any) => sum + (list.product_count || 0), 0);
  }, [lists]);

  const handleAddToRequest = (product: any) => {
    const existingItem = requestList.find((r) => r.productId === product.id);

    if (existingItem) {
      setRequestList((prev) => prev.map((r) => (r.productId === product.id ? { ...r, quantity: r.quantity + 1 } : r)));
      toast.success("Cantidad actualizada en la lista de pedidos");
    } else {
      const newRequest: RequestItem = {
        id: Date.now().toString(),
        productId: product.id,
        code: product.code || "",
        name: product.name || "",
        supplierId: product.supplierId || "",
        costPrice: Number(product.price) || 0,
        quantity: 1,
      };
      setRequestList((prev) => [...prev, newRequest]);
      toast.success("Producto agregado a la lista de pedidos");
    }
  };

  const handleUpdateRequestQuantity = (id: string, quantity: number) => {
    setRequestList((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)));
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

    const uniqueSuppliers = new Set(requestList.map((item) => item.supplierId)).size;

    toast.success("Pedidos exportados", {
      description: `Se generaron ${uniqueSuppliers} archivo${uniqueSuppliers > 1 ? "s" : ""} (uno por proveedor)`,
    });
  };

  return (
    <div className="min-h-screen w-full bg-background overflow-x-hidden">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="w-full px-4 py-6 max-w-full overflow-hidden">
          <h1 className="text-3xl font-bold mb-6">Stock de Productos</h1>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex gap-2 ml-auto">
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

              <Button variant="outline" onClick={handleExportToExcel} disabled={requestList.length === 0}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar Pedido
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm text-muted-foreground">
              {totalProducts} productos en total
              {" • "}
              {visibleSupplierSections.length} {visibleSupplierSections.length === 1 ? "proveedor" : "proveedores"}
            </div>
          </div>
        </div>
      </header>

      <div className="w-full px-4 py-6 max-w-full overflow-hidden">
        <RequestCart
          requests={requestList}
          onUpdateQuantity={handleUpdateRequestQuantity}
          onRemove={handleRemoveFromRequest}
          onExport={handleExportToExcel}
          suppliers={suppliers}
          isCollapsed={isCartCollapsed}
          onToggleCollapse={() => setIsCartCollapsed(!isCartCollapsed)}
        />

        <div className="w-full">
          {isLoading ? (
            <div className="text-center py-12 space-y-4">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
              <p className="text-muted-foreground">Cargando listas...</p>
            </div>
          ) : visibleSupplierSections.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No se encontraron proveedores</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {visibleSupplierSections.map(([supplierId, section]) => (
                <SupplierStockSection
                  key={supplierId}
                  supplierName={section.supplierName}
                  supplierLogo={section.supplierLogo}
                  lists={section.lists}
                  onAddToRequest={handleAddToRequest}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
