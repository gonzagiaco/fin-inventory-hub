import { useState, useMemo } from "react";
import { Filter, FileDown, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { QuantityCell } from "@/components/stock/QuantityCell";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getOfflineData } from "@/lib/localDB";
import { GlobalProductSearch } from "@/components/GlobalProductsSearch";
import { useIsMobile } from "@/hooks/use-mobile";

// Helper function to extract name from product data for search results
function extractNameFromFullData(
  data: Record<string, any>, 
  schema: any[], 
  mappingConfig?: any
): string {
  // 1. PRIORIDAD: Usar name_keys del mapping_config
  if (mappingConfig?.name_keys && Array.isArray(mappingConfig.name_keys)) {
    for (const key of mappingConfig.name_keys) {
      if (data[key] && String(data[key]).trim()) {
        return String(data[key]).trim();
      }
    }
  }
  
  // 2. FALLBACK: Buscar en schema (columnas text que no sean code/price)
  for (const col of schema) {
    if (col.key !== "code" && col.key !== "price" && col.type === "text" && data[col.key]) {
      return String(data[col.key]);
    }
  }
  
  // 3. FALLBACK FINAL: Campos comunes
  const commonNameFields = ["name", "nombre", "descripcion", "description", "producto", "product"];
  for (const field of commonNameFields) {
    if (data[field]) {
      return String(data[field]);
    }
  }
  
  return "Sin nombre";
}

export default function Stock() {
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [requestList, setRequestList] = useState<RequestItem[]>([]);
  const [isCartCollapsed, setIsCartCollapsed] = useState(true);

  const { data: lists = [], isLoading: isLoadingLists } = useProductListsIndex();
  const { suppliers = [], isLoading: isLoadingSuppliers } = useSuppliers();
  const [searchTerm, setSearchTerm] = useState("");
  const isOnline = useOnlineStatus();
  const isMobile = useIsMobile();
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
          columnSchema: any[];
        }>;
      }
    >();

    lists.forEach((list: any) => {
      const supplier = suppliers.find((s) => s.id === list.supplier_id);
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
        columnSchema: list.column_schema || [],
      });
    });

    sections.forEach((section, key) => {
      console.log("Sección:", key);
      console.log("Proveedor:", section.supplierName);
      console.log("Listas:");
      section.lists.forEach((list) => {
        console.log(`  - ID: ${list.id}`);
        console.log(`    Nombre: ${list.name}`);
        console.log(`    Productos: ${list.productCount}`);
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

  const isSupplierSelectedNoTerm = supplierFilter !== "all" && searchTerm.trim() === "";
  const hasSearchTerm = searchTerm.trim().length >= 3 || (isOnline === false && searchTerm.trim().length >= 1);

  const { data: globalResults = [], isLoading: loadingSearch } = useQuery({
    queryKey: ["global-search", searchTerm, supplierFilter, isOnline ? "online" : "offline"],
    queryFn: async () => {
      if (!searchTerm || searchTerm.trim().length < 1) return [];

      // MODO OFFLINE: Buscar en IndexedDB
      if (isOnline === false) {
        const indexedProducts = (await getOfflineData("dynamic_products_index")) as any[];
        const fullProducts = (await getOfflineData("dynamic_products")) as any[];
        const productLists = (await getOfflineData("product_lists")) as any[];
        const searchTermLower = searchTerm.trim().toLowerCase();

        // Filtrar por término de búsqueda
        let filtered = indexedProducts.filter((p: any) => {
          // Buscar en índice primero
          if (p.code?.toLowerCase().includes(searchTermLower) 
              || p.name?.toLowerCase().includes(searchTermLower)) {
            return true;
          }
          
          // Si el índice no tiene datos, buscar en producto completo
          const fullProduct = fullProducts.find((fp: any) => fp.id === p.product_id);
          if (!fullProduct?.data) return false;
          
          const list = productLists.find((l: any) => l.id === p.list_id);
          const mappingConfig = list?.mapping_config;
          
          // Buscar en todos los code_keys configurados
          if (mappingConfig?.code_keys && Array.isArray(mappingConfig.code_keys)) {
            for (const key of mappingConfig.code_keys) {
              if (fullProduct.data[key]?.toString().toLowerCase().includes(searchTermLower)) {
                return true;
              }
            }
          }
          
          // Buscar en todos los name_keys configurados
          if (mappingConfig?.name_keys && Array.isArray(mappingConfig.name_keys)) {
            for (const key of mappingConfig.name_keys) {
              if (fullProduct.data[key]?.toString().toLowerCase().includes(searchTermLower)) {
                return true;
              }
            }
          }
          
          return false;
        });

        // Filtrar por proveedor si está seleccionado
        if (supplierFilter !== "all") {
          filtered = filtered.filter((p: any) => {
            const list = productLists.find((l: any) => l.id === p.list_id);
            return list?.supplier_id === supplierFilter;
          });
        }

        // Enrich with missing names from full products data
        filtered = filtered.map((p: any) => {
          if (!p.name || p.name.trim() === "") {
            const fullProduct = fullProducts.find((fp: any) => fp.id === p.product_id);
            const list = productLists.find((l: any) => l.id === p.list_id);
            const columnSchema = list?.column_schema || [];
            const mappingConfig = list?.mapping_config;

            if (fullProduct?.data) {
              // Extract name from data using schema and mappingConfig
              const extractedName = extractNameFromFullData(fullProduct.data, columnSchema, mappingConfig);
              return { ...p, name: extractedName };
            }
          }
          return p;
        });

        return filtered;
      }

      // MODO ONLINE: Usar RPC de Supabase
      const { data, error } = await supabase.rpc("search_products", {
        p_term: searchTerm.trim(),
        p_supplier_id: supplierFilter === "all" ? null : supplierFilter,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: hasSearchTerm,
    retry: false,
  });

  return (
    <div className="min-h-screen w-full bg-background overflow-x-hidden">
      <header
        className="sticky top-0 z-10 bg-background border-b"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
      >
        <div className="w-full px-4 py-10 lg:pl-4 max-w-full overflow-hidden">
          <h1 className="text-3xl font-bold mb-6">Stock de Productos</h1>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex w-full flex-1 gap-2">
              <Input
                placeholder="Buscar en todos los productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="md:w-96 w-full"
              />
            </div>
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

          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm text-muted-foreground">
              {totalProducts} productos en total{" • "}
              {visibleSupplierSections.length}{" "}
              {visibleSupplierSections.length === 1
                ? "proveedor"
                : "proveedores"}
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
            // ------- Estado de carga de listas -------
            <div className="text-center py-12 space-y-4">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
              <p className="text-muted-foreground">Cargando listas...</p>
            </div>
          ) : searchTerm.trim().length >= 3 ||
            (searchTerm === "" && supplierFilter !== "all") ? (
            hasSearchTerm && (
              <GlobalProductSearch
                searchTerm={searchTerm}
                globalResults={globalResults}
                loadingSearch={loadingSearch}
                isSupplierSelectedNoTerm={isSupplierSelectedNoTerm}
                isOnline={isOnline}
                lists={lists}
                suppliers={suppliers}
                onAddToRequest={handleAddToRequest}
                defaultViewMode={isMobile ? "card" : "table"}
              />
            )
          ) : visibleSupplierSections.length === 0 ? (
            // ------- Sin proveedores -------
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                No se encontraron proveedores
              </p>
            </Card>
          ) : (
            // ------- Secciones de proveedores (como antes) -------
            <div className="space-y-6">
              {visibleSupplierSections.map(([supplierId, section]: any) => (
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
