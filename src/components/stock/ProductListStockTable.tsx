import { useState } from "react";
import { ChevronDown, ChevronUp, ShoppingCart, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductListDetails, EnrichedProduct } from "@/hooks/useAllDynamicProducts";
import { ColumnSettingsDrawer } from "@/components/ColumnSettingsDrawer";
import { useProductListStore } from "@/stores/productListStore";
import { ProductCardView } from "@/components/ProductCardView";
import { CardPreviewSettings } from "@/components/CardPreviewSettings";
import { List, LayoutGrid } from "lucide-react";

interface ProductListStockTableProps {
  list: ProductListDetails;
  products: EnrichedProduct[];
  onAddToRequest: (product: EnrichedProduct) => void;
}

export function ProductListStockTable({
  list,
  products,
  onAddToRequest,
}: ProductListStockTableProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Get column configuration and view mode from store
  const { 
    columnVisibility, 
    columnOrder,
    viewMode: storeViewMode,
    setViewMode
  } = useProductListStore();

  // Automatically use card view if many columns
  const shouldUseCardView = list.columnSchema.length > 8;
  const currentViewMode = storeViewMode[list.listId] || "table";
  const effectiveViewMode = shouldUseCardView ? currentViewMode : "table";

  const visibilityState = columnVisibility[list.listId] || {};
  const currentOrder = columnOrder[list.listId] || list.columnSchema.map((col) => col.key);

  // Get visible columns in order
  const visibleColumns = currentOrder
    .map((key) => list.columnSchema.find((col) => col.key === key))
    .filter((col): col is typeof list.columnSchema[number] => 
      col !== undefined && visibilityState[col.key] !== false
    );

  const lowStockCount = products.filter((p) => (p.quantity || 0) < 50).length;

  return (
    <div className="border rounded-lg">
      <div className="flex items-center justify-between p-4 bg-muted/50">
        <div className="flex items-center gap-3 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <div className="flex-1">
            <h3 className="font-semibold">{list.listName}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{products.length} productos</span>
              {lowStockCount > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {lowStockCount} bajo stock
                  </span>
                </>
              )}
            </div>
          </div>
          {shouldUseCardView && (
            <div className="flex gap-2">
              <Button
                variant={effectiveViewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(list.listId, "table")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={effectiveViewMode === "cards" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(list.listId, "cards")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <CardPreviewSettings listId={list.listId} columnSchema={list.columnSchema} />
            </div>
          )}
          <ColumnSettingsDrawer listId={list.listId} columnSchema={list.columnSchema} />
        </div>
      </div>

      {isExpanded && (
        effectiveViewMode === "cards" ? (
          <div className="p-4">
            <ProductCardView
              listId={list.listId}
              products={products}
              columnSchema={list.columnSchema}
              onAddToRequest={onAddToRequest}
              showActions={true}
            />
          </div>
        ) : (
          <div className="border-t">
            <div className="overflow-x-auto">
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.map((column) => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 1} className="text-center text-muted-foreground">
                      No hay productos en esta lista
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => {
                    const quantity = product.quantity || 0;
                    const isLowStock = quantity < 50;

                    return (
                      <TableRow key={product.id}>
                        {visibleColumns.map((column) => {
                          let value: any;
                          
                          // Get value from standard fields or data
                          if (column.key === 'code') value = product.code;
                          else if (column.key === 'name') value = product.name;
                          else if (column.key === 'price') value = product.price;
                          else if (column.key === 'quantity') value = product.quantity;
                          else value = product.data[column.key];

                          // Format value based on type
                          let displayValue: string;
                          if (value == null) {
                            displayValue = '-';
                          } else if (column.type === 'number') {
                            displayValue = typeof value === 'number' 
                              ? value.toLocaleString('es-AR')
                              : String(value);
                          } else if (column.type === 'date') {
                            displayValue = value instanceof Date
                              ? value.toLocaleDateString('es-AR')
                              : String(value);
                          } else {
                            displayValue = String(value);
                          }

                          return (
                            <TableCell key={column.key}>
                              {column.key === 'quantity' && isLowStock ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="destructive" className="text-xs">
                                    Bajo Stock
                                  </Badge>
                                  <span>{displayValue}</span>
                                </div>
                              ) : (
                                displayValue
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAddToRequest(product)}
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Agregar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
