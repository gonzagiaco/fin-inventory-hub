import { useMemo, useState } from "react";
import { List, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuantityCell } from "./QuantityCell";
import { ProductCardView } from "@/components/ProductCardView";
import { ColumnSchema, DynamicProduct } from "@/types/productList";
import { normalizeRawPrice, formatARS } from "@/utils/numberParser";
import { AddProductDropdown } from "./AddProductDropdown";
import { ColumnSettingsDrawer } from "@/components/ColumnSettingsDrawer";
import { useProductListStore } from "@/stores/productListStore";

interface MyStockListProductsProps {
  listId: string;
  products: any[];
  columnSchema: ColumnSchema[];
  mappingConfig: any;
  onAddToRequest: (product: any, mappingConfig?: any) => void;
  isMobile: boolean;
}

export function MyStockListProducts({
  listId,
  products,
  columnSchema,
  mappingConfig,
  onAddToRequest,
  isMobile,
}: MyStockListProductsProps) {
  const [viewMode, setViewMode] = useState<string>(isMobile ? "cards" : "table");
  const { columnVisibility, columnOrder } = useProductListStore();

  // Get original labels from columnSchema based on mappingConfig keys
  const dynamicSchema: ColumnSchema[] = useMemo(() => {
    const codeKey = mappingConfig?.code_keys?.[0];
    const nameKey = mappingConfig?.name_keys?.[0];
    const priceKey = mappingConfig?.price_primary_key;

    // Find original labels from columnSchema
    const codeColumn = columnSchema.find(c => c.key === codeKey);
    const nameColumn = columnSchema.find(c => c.key === nameKey);
    const priceColumn = columnSchema.find(c => c.key === priceKey);
    const stockColumn = columnSchema.find(c => c.key === "quantity");

    return [
      { key: "code", label: codeColumn?.label || "Código", type: "text", visible: true, order: 0, isStandard: true },
      { key: "name", label: nameColumn?.label || "Nombre", type: "text", visible: true, order: 1, isStandard: true },
      { key: "price", label: priceColumn?.label || "Precio", type: "number", visible: true, order: 2, isStandard: true },
      { key: "quantity", label: stockColumn?.label || "Stock", type: "number", visible: true, order: 3, isStandard: true },
    ];
  }, [columnSchema, mappingConfig]);

  // Get visibility settings for this list
  const visibilityState = columnVisibility[listId] || {};
  const currentOrder = columnOrder[listId] || dynamicSchema.map(c => c.key);

  // Apply visibility and order settings
  const visibleColumns = useMemo(() => {
    return currentOrder
      .map(key => dynamicSchema.find(c => c.key === key))
      .filter((col): col is ColumnSchema => col !== undefined && visibilityState[col.key] !== false);
  }, [currentOrder, dynamicSchema, visibilityState]);

  // Transform products for card view
  const transformedProducts: DynamicProduct[] = useMemo(() => {
    return products.map((p) => ({
      id: p.id,
      listId: p.listId,
      code: p.code,
      name: p.name,
      price: p.price,
      quantity: p.quantity,
      data: {},
      calculated_data: p.calculated_data || {},
      supplierId: p.supplierId,
      mappingConfig,
    }));
  }, [products, mappingConfig]);

  const lowStockThreshold = mappingConfig?.low_stock_threshold || 0;

  if (products.length === 0) {
    return (
      <div className="p-6 text-center border-t text-muted-foreground">
        No hay productos con stock en esta lista
      </div>
    );
  }

  const ViewToggle = () => (
    <div className="flex justify-end gap-1.5">
      <Button
        variant={viewMode === "table" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode("table")}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === "cards" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode("cards")}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );

  if (viewMode === "cards") {
    return (
      <div className="p-4 border-t">
        <div className="flex justify-between items-center mb-4">
          <ColumnSettingsDrawer listId={listId} columnSchema={dynamicSchema} />
          {!isMobile && <ViewToggle />}
        </div>
        <ProductCardView
          listId={listId}
          products={transformedProducts}
          columnSchema={visibleColumns.length > 0 ? visibleColumns : dynamicSchema}
          mappingConfig={mappingConfig}
          onAddToRequest={(product) => onAddToRequest(product, mappingConfig)}
          showActions={true}
        />
      </div>
    );
  }

  return (
    <div className="p-4 border-t">
      <div className="flex justify-between items-center mb-4">
        <ColumnSettingsDrawer listId={listId} columnSchema={dynamicSchema} />
        <ViewToggle />
      </div>

      <div className="w-full border rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-auto relative">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Acciones</TableHead>
                {visibleColumns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isLowStock = (product.quantity || 0) < lowStockThreshold;
                const priceValue = normalizeRawPrice(product.price);

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <AddProductDropdown
                        product={product}
                        mappingConfig={mappingConfig}
                        onAddToRequest={onAddToRequest}
                        showAddToStock={false}
                      />
                    </TableCell>
                    {visibleColumns.map((col) => {
                      if (col.key === "code") {
                        return <TableCell key={col.key}>{product.code || "-"}</TableCell>;
                      }
                      if (col.key === "name") {
                        return <TableCell key={col.key}>{product.name || "-"}</TableCell>;
                      }
                      if (col.key === "price") {
                        return (
                          <TableCell key={col.key}>
                            {priceValue != null ? formatARS(priceValue) : "-"}
                          </TableCell>
                        );
                      }
                      if (col.key === "quantity") {
                        return (
                          <TableCell key={col.key}>
                            <div className="flex items-center gap-2">
                              {isLowStock && lowStockThreshold > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  Bajo Stock
                                </Badge>
                              )}
                              <QuantityCell
                                productId={product.id}
                                listId={product.listId}
                                value={product.quantity}
                                visibleSpan={false}
                              />
                            </div>
                          </TableCell>
                        );
                      }
                      return null;
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
