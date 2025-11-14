import { useState, useMemo } from "react";
import { List, LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { QuantityCell } from "@/components/stock/QuantityCell";
import { ProductCardView } from "@/components/ProductCardView";
import { ColumnSchema, DynamicProduct } from "@/types/productList";

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

  // Transformar resultados a formato DynamicProduct
  const transformedResults = useMemo(() => {
    return globalResults.map((item: any) => {
      const listInfo = lists.find((l: any) => l.id === item.list_id);
      const supplierInfo = suppliers.find((s: any) => s.id === listInfo?.supplier_id);

      return {
        id: item.product_id,
        listId: item.list_id,
        code: item.code || "-",
        name: item.name || "-",
        price: Number(item.price) || 0,
        quantity: item.quantity || 0,
        supplierId: supplierInfo?.id || "",
        mappingConfig: listInfo?.mapping_config,
        data: {
          code: item.code || "-",
          name: item.name || "-",
          price: Number(item.price) || 0,
          quantity: item.quantity || 0,
          supplier_name: supplierInfo?.name || "-",
          list_name: listInfo?.name || "-",
        },
        calculated_data: item.calculated_data || {},
      } as DynamicProduct;
    });
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
        <ProductCardView
          listId="global-search"
          products={transformedResults}
          columnSchema={globalSearchSchema}
          onAddToRequest={(product) =>
            onAddToRequest({
              id: product.id,
              code: product.code,
              name: product.name,
              price: product.price,
              supplierId: product.supplierId,
            })
          }
          showActions={true}
        />
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
                      <QuantityCell
                        productId={item.product_id}
                        listId={item.list_id}
                        value={item.quantity}
                        visibleSpan={false}
                      />
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
