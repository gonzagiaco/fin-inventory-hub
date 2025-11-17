import { useState, useMemo, useEffect } from "react";
import { List, LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { QuantityCell } from "@/components/stock/QuantityCell";
import { ProductCardView } from "@/components/ProductCardView";
import { ColumnSchema, DynamicProduct } from "@/types/productList";
import { useProductListStore } from "@/stores/productListStore";

interface GlobalProductSearchProps {
  searchTerm: string;
  globalResults: any[];
  loadingSearch: boolean;
  isSupplierSelectedNoTerm: boolean;
  isOnline: boolean;
  lists: any[];
  suppliers: any[];
  onAddToRequest: (product: any) => void;
  defaultViewMode?: "table" | "card";
}

export function GlobalProductSearch({
  searchTerm,
  globalResults,
  loadingSearch,
  isSupplierSelectedNoTerm,
  isOnline,
  lists,
  suppliers,
  onAddToRequest,
  defaultViewMode = "card",
}: GlobalProductSearchProps) {
  const [viewMode, setViewMode] = useState(() => defaultViewMode);
  const { setCardPreviewFields, cardPreviewFields } = useProductListStore();

  useEffect(() => {
    const globalSearchId = "global-search-results";

    if (!cardPreviewFields[globalSearchId]) {
      setCardPreviewFields(globalSearchId, ["code", "name", "price", "quantity", "supplier_name" /*, "list_name"*/]);
    }
  }, []);

  // Schema genérico para resultados de búsqueda global
  const globalSearchSchema: ColumnSchema[] = useMemo(
    () => [
      { key: "code", label: "Código", type: "text", visible: true, order: 0 },
      { key: "name", label: "Nombre", type: "text", visible: true, order: 1 },
      {
        key: "price",
        label: "Precio",
        type: "number",
        visible: true,
        order: 2,
      },
      {
        key: "quantity",
        label: "Stock",
        type: "number",
        visible: true,
        order: 3,
      },
      {
        key: "supplier_name",
        label: "Proveedor",
        type: "text",
        visible: true,
        order: 4,
      },
      {
        key: "list_name",
        label: "Lista",
        type: "text",
        visible: true,
        order: 5,
      },
    ],
    [],
  );

  // Schema para vista de tarjetas (sin campo "Lista")
  const globalSearchSchemaForCards: ColumnSchema[] = useMemo(
    () => globalSearchSchema.filter((col) => col.key !== "list_name"),
    [globalSearchSchema],
  );

  // Agrupar resultados por lista para renderizar con configuraciones específicas
  const resultsByList = useMemo(() => {
    const grouped = new Map<
      string,
      {
        listId: string;
        listName: string;
        supplierId: string;
        supplierName: string;
        supplierLogo: string | null;
        columnSchema: ColumnSchema[];
        mappingConfig: any;
        products: DynamicProduct[];
      }
    >();

    globalResults.forEach((item: any) => {
      const listInfo = lists.find((l: any) => l.id === item.list_id);
      const supplierInfo = suppliers.find((s: any) => s.id === listInfo?.supplier_id);

      if (!listInfo) return;

      if (!grouped.has(item.list_id)) {
        grouped.set(item.list_id, {
          listId: item.list_id,
          listName: listInfo.name,
          supplierId: supplierInfo?.id || "",
          supplierName: supplierInfo?.name || "-",
          supplierLogo: supplierInfo?.logo || null,
          columnSchema: listInfo.column_schema || [],
          mappingConfig: listInfo.mapping_config,
          products: [],
        });
      }

      grouped.get(item.list_id)!.products.push({
        id: item.product_id,
        listId: item.list_id,
        code: item.code || "-",
        name: item.name || "-",
        price: Number(item.price) || 0,
        quantity: item.quantity || 0,
        supplierId: supplierInfo?.id || "",
        supplierName: supplierInfo?.name || "-",
        listName: listInfo.name,
        mappingConfig: listInfo?.mapping_config,
        data: item.dynamic_products?.data || {},
        calculated_data: item.calculated_data || {},
      } as DynamicProduct);
    });

    return Array.from(grouped.values());
  }, [globalResults, lists, suppliers]);

  // Estado: Proveedor seleccionado sin término de búsqueda
  if (isSupplierSelectedNoTerm) {
    return (
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-2">Búsqueda por proveedor</h2>
        <p className="text-center text-muted-foreground">
          Seleccionaste un proveedor. Escribe al menos 3 caracteres para buscar productos.
        </p>
      </Card>
    );
  }

  // Estado: Cargando
  if (loadingSearch) {
    return (
      <Card className="p-4">
        <p className="text-center text-muted-foreground">Buscando productos...</p>
      </Card>
    );
  }

  // Estado: Sin resultados
  if (globalResults.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-2">
          Resultados de búsqueda para "{searchTerm.trim()}"
          {isOnline === false && <span className="ml-2 text-sm text-muted-foreground">(modo offline)</span>}
        </h2>
        <p className="text-center text-muted-foreground">No se encontraron productos.</p>
      </Card>
    );
  }

  // Estado: Con resultados
  return (
    <Card className="p-4">
      {/* Header con título y botones de vista */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">
            Resultados de búsqueda para "{searchTerm.trim()}"
            {isOnline === false && <span className="ml-2 text-sm text-muted-foreground">(modo offline)</span>}
          </h2>

          {/* Botones de toggle vista */}
          <div className="flex gap-1.5">
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="flex-shrink-0"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "card" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="flex-shrink-0"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Contenido condicional: tabla o tarjetas */}
      {viewMode === "card" ? (
        <div className="space-y-6">
          {resultsByList.map((listGroup) => (
            <div key={listGroup.listId} className="border rounded-lg p-4">
              {/* Header de la lista */}
              <div className="flex items-center gap-3 mb-4">
                {listGroup.supplierLogo && (
                  <img
                    src={listGroup.supplierLogo}
                    alt={listGroup.supplierName}
                    className="h-8 w-8 object-contain rounded"
                  />
                )}
                <div>
                  <h3 className="font-semibold">{listGroup.listName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {listGroup.supplierName} • {listGroup.products.length} productos
                  </p>
                </div>
              </div>

              {/* Tarjetas de productos - 100% idénticas a Stock */}
              <ProductCardView
                listId="global-search-results"
                products={listGroup.products}
                columnSchema={globalSearchSchemaForCards}
                mappingConfig={listGroup.mappingConfig}
                onAddToRequest={(product) =>
                  onAddToRequest({
                    id: product.id,
                    code: product.code,
                    name: product.name,
                    price: product.price,
                    supplierId: listGroup.supplierId,
                  })
                }
                showActions={true}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Acciones</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Lista</TableHead>
                <TableHead>Precio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {globalResults.map((item: any) => {
                const listInfo = lists.find((l: any) => l.id === item.list_id);
                const supplierInfo = suppliers.find((s: any) => s.id === listInfo?.supplier_id);

                return (
                  <TableRow key={item.product_id}>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onAddToRequest({
                            id: item.product_id,
                            code: item.code,
                            name: item.name,
                            price: Number(item.price) || 0,
                            quantity: 1,
                            supplierId: supplierInfo ? supplierInfo.id : "",
                          })
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" /> Agregar
                      </Button>
                    </TableCell>

                    <TableCell>
                      {(() => {
                        const listInfo = lists.find((l: any) => l.id === item.list_id);
                        const lowStockThreshold = listInfo?.mapping_config?.low_stock_threshold || 50;
                        const isLowStock = (item.quantity || 0) < lowStockThreshold;

                        return (
                          <div className="flex items-center gap-2">
                            {isLowStock && (
                              <Badge variant="destructive" className="text-xs">
                                Bajo Stock
                              </Badge>
                            )}
                            <QuantityCell
                              productId={item.product_id}
                              listId={item.list_id}
                              value={item.quantity}
                              visibleSpan={false}
                            />
                          </div>
                        );
                      })()}
                    </TableCell>

                    <TableCell>{item.code || "-"}</TableCell>
                    <TableCell>{item.name || "-"}</TableCell>
                    <TableCell>{supplierInfo ? supplierInfo.name : "-"}</TableCell>
                    <TableCell>{listInfo ? listInfo.name : "-"}</TableCell>
                    <TableCell>
                      {item.price && !isNaN(item.price)
                        ? new Intl.NumberFormat("es-AR", {
                            style: "currency",
                            currency: "ARS",
                          }).format(item.price)
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
