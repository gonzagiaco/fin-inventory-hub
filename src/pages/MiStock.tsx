import { useState, useMemo, useEffect } from "react";
import { Filter, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMyStockProducts } from "@/hooks/useMyStockProducts";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useProductListsIndex } from "@/hooks/useProductListsIndex";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { MyStockSupplierSection } from "@/components/stock/MyStockSupplierSection";
import RequestCart from "@/components/RequestCart";
import { RequestItem } from "@/types";
import { exportOrdersBySupplier } from "@/utils/exportOrdersBySupplier";
import { toast } from "sonner";

export default function MiStock() {
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyWithStock, setOnlyWithStock] = useState(false);
  const [requestList, setRequestList] = useState<RequestItem[]>([]);
  const [isCartCollapsed, setIsCartCollapsed] = useState(true);
  
  // Estado local para actualizaciones optimistas
  const [localProducts, setLocalProducts] = useState<any[]>([]);

  const { suppliers = [], isLoading: isLoadingSuppliers } = useSuppliers();
  const { data: lists = [], isLoading: isLoadingLists } = useProductListsIndex();
  const isOnline = useOnlineStatus();
  const isMobile = useIsMobile();

  const { data: myStockProducts = [], isLoading: isLoadingProducts } = useMyStockProducts({
    supplierId: supplierFilter,
    searchTerm,
    onlyWithStock,
  });

  // Sincronizar estado local con datos de la query
  useEffect(() => {
    if (myStockProducts && myStockProducts.length > 0) {
      setLocalProducts(myStockProducts);
    }
  }, [myStockProducts]);

  // Handler para actualizar cantidad localmente (optimista)
  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    setLocalProducts(prev => 
      prev.map(p => 
        (p.product_id === productId) ? { ...p, quantity: newQuantity } : p
      )
    );
  };

  // Handler para eliminar producto localmente (optimista)
  const handleRemoveProduct = (productId: string) => {
    setLocalProducts(prev => 
      prev.filter(p => p.product_id !== productId)
    );
  };

  // Handler para actualizar umbral localmente (optimista)
  const handleUpdateThreshold = (productId: string, newThreshold: number) => {
    setLocalProducts(prev => 
      prev.map(p => 
        (p.product_id === productId) ? { ...p, stock_threshold: newThreshold } : p
      )
    );
  };

  const isLoading = isLoadingSuppliers || isLoadingLists || isLoadingProducts;

  // Usar localProducts en lugar de myStockProducts para UI
  const productsToDisplay = localProducts.length > 0 ? localProducts : myStockProducts;

  // Group products by supplier and then by list
  const supplierSections = useMemo(() => {
    const sections = new Map<
      string,
      {
        supplierName: string;
        supplierLogo: string | null;
        lists: Map<
          string,
          {
            listId: string;
            listName: string;
            mappingConfig: any;
            columnSchema: any[];
            products: any[];
          }
        >;
      }
    >();

    // Create a map of list_id to list info
    const listInfoMap = new Map<string, any>();
    lists.forEach((list: any) => {
      listInfoMap.set(list.id, list);
    });

    productsToDisplay.forEach((product: any) => {
      const listInfo = listInfoMap.get(product.list_id);
      if (!listInfo) return;

      const supplier = suppliers.find((s) => s.id === listInfo.supplier_id);
      if (!supplier) return;

      if (!sections.has(supplier.id)) {
        sections.set(supplier.id, {
          supplierName: supplier.name,
          supplierLogo: supplier.logo,
          lists: new Map(),
        });
      }

      const section = sections.get(supplier.id)!;
      if (!section.lists.has(listInfo.id)) {
        section.lists.set(listInfo.id, {
          listId: listInfo.id,
          listName: listInfo.name,
          mappingConfig: listInfo.mapping_config,
          columnSchema: listInfo.column_schema || [],
          products: [],
        });
      }

      section.lists.get(listInfo.id)!.products.push({
        id: product.product_id,
        product_id: product.product_id,
        listId: product.list_id,
        list_id: product.list_id,
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: product.quantity,
        calculated_data: product.calculated_data,
        data: product.data,
        supplierId: supplier.id,
      });
    });

    return sections;
  }, [productsToDisplay, lists, suppliers]);

  const visibleSupplierSections = useMemo(() => {
    if (supplierFilter === "all") {
      return Array.from(supplierSections.entries());
    }
    return Array.from(supplierSections.entries()).filter(([supplierId]) => supplierId === supplierFilter);
  }, [supplierSections, supplierFilter]);

  // Parse price for request list
  function parsePriceValue(value: any): number | null {
    if (value == null) return null;
    if (typeof value === "number") return isFinite(value) ? value : null;
    const cleaned = String(value)
      .replace(/[^0-9.,-]/g, "")
      .replace(",", ".");
    const parsed = parseFloat(cleaned);
    return !isNaN(parsed) && isFinite(parsed) ? parsed : null;
  }

  const handleAddToRequest = (product: any, mappingConfig?: any) => {
    const existingItem = requestList.find((r) => r.productId === product.id);
    const effectiveSupplierId = product.supplierId || "";

    if (existingItem) {
      setRequestList((prev) => prev.map((r) => (r.productId === product.id ? { ...r, quantity: r.quantity + 1 } : r)));
      toast.success("Cantidad actualizada en la lista de pedidos");
    } else {
      let finalPrice = parsePriceValue(product.price) ?? 0;
      const cartPriceColumn = mappingConfig?.cart_price_column;
      if (cartPriceColumn && product.calculated_data?.[cartPriceColumn]) {
        const fromCalculated = parsePriceValue(product.calculated_data[cartPriceColumn]);
        if (fromCalculated != null) finalPrice = fromCalculated;
      }

      const newRequest: RequestItem = {
        id: Date.now().toString(),
        productId: product.id,
        code: product.code || "",
        name: product.name || "",
        supplierId: effectiveSupplierId,
        costPrice: finalPrice,
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

  const totalProducts = productsToDisplay.length;
  const productsWithStock = productsToDisplay.filter((p: any) => (p.quantity || 0) > 0).length;

  return (
    <div className="min-h-screen w-full bg-background overflow-x-hidden">
      <header
        className="sticky top-0 z-10 bg-background border-b"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
      >
        <div className="w-full px-4 pt-5 pb-6 lg:pl-4 max-w-full overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Mi Stock</h1>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="Buscar en mi stock..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[200px] gap-1">
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

              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
                <Switch id="only-with-stock" checked={onlyWithStock} onCheckedChange={setOnlyWithStock} />
                <Label htmlFor="only-with-stock" className="text-sm whitespace-nowrap cursor-pointer">
                  Sólo con stock
                </Label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
            <span>{totalProducts} productos en mi stock</span>
            <span>•</span>
            <span>{productsWithStock} con stock disponible</span>
            <span>•</span>
            <span>
              {visibleSupplierSections.length} {visibleSupplierSections.length === 1 ? "proveedor" : "proveedores"}
            </span>
            {!isOnline && <span className="text-amber-500">(modo offline)</span>}
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
              <p className="text-muted-foreground">Cargando mi stock...</p>
            </div>
          ) : visibleSupplierSections.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No hay productos en tu stock</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? `No se encontraron productos para "${searchTerm}"`
                  : "Agrega productos desde las listas de proveedores o edita la cantidad de stock de cualquier producto."}
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {visibleSupplierSections.map(([supplierId, section]) => (
                <MyStockSupplierSection
                  key={supplierId}
                  supplierName={section.supplierName}
                  supplierLogo={section.supplierLogo}
                  lists={Array.from(section.lists.values())}
                  onAddToRequest={handleAddToRequest}
                  onQuantityChange={handleUpdateQuantity}
                  onThresholdChange={handleUpdateThreshold}
                  onRemoveProduct={handleRemoveProduct}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
