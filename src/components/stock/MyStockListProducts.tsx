import { useMemo, useState } from "react";
import { Plus, List, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuantityCell } from "./QuantityCell";
import { ProductCardView } from "@/components/ProductCardView";
import { ColumnSchema, DynamicProduct } from "@/types/productList";
import { normalizeRawPrice, formatARS } from "@/utils/numberParser";
import { AddProductDropdown } from "./AddProductDropdown";

interface MyStockListProductsProps {
  listId: string;
  products: any[];
  columnSchema: any[];
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

  // Create a simplified schema for My Stock view
  const myStockSchema: ColumnSchema[] = useMemo(() => [
    { key: "code", label: "Código", type: "text", visible: true, order: 0 },
    { key: "name", label: "Nombre", type: "text", visible: true, order: 1 },
    { key: "price", label: "Precio", type: "number", visible: true, order: 2 },
    { key: "quantity", label: "Stock", type: "number", visible: true, order: 3 },
  ], []);

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
    <div className="flex justify-end gap-1.5 mb-4">
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
        {!isMobile && <ViewToggle />}
        <ProductCardView
          listId={listId}
          products={transformedProducts}
          columnSchema={myStockSchema}
          mappingConfig={mappingConfig}
          onAddToRequest={(product) => onAddToRequest(product, mappingConfig)}
          showActions={true}
        />
      </div>
    );
  }

  return (
    <div className="p-4 border-t">
      <ViewToggle />

      <div className="w-full border rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-auto relative">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Acciones</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Stock</TableHead>
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
                    <TableCell>{product.code || "-"}</TableCell>
                    <TableCell>{product.name || "-"}</TableCell>
                    <TableCell>
                      {priceValue != null ? formatARS(priceValue) : "-"}
                    </TableCell>
                    <TableCell>
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
