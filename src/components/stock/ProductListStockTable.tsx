import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, ShoppingCart, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
import { ColumnConfigurationDialog } from "@/components/ColumnConfigurationDialog";
import { List, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(0);
  const itemsPerPage = 50;
  
  // Get column configuration and view mode from store
  const { 
    columnVisibility, 
    columnOrder,
    viewMode: storeViewMode,
    setViewMode,
    quantityColumn,
    lowStockThreshold,
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

  const quantityColumnKey = quantityColumn[list.listId] || "quantity";
  const threshold = lowStockThreshold[list.listId] || 50;

  const getQuantityValue = (product: EnrichedProduct): number => {
    const value = quantityColumnKey === "quantity" 
      ? product.quantity 
      : product.data?.[quantityColumnKey];
    return Number(value) || 0;
  };

  const lowStockCount = products.filter((p) => getQuantityValue(p) < threshold).length;

  const handleStartEditing = (productId: string, currentQty: number) => {
    setEditingQuantity(productId);
    setTempQuantity(currentQty);
  };

  const handleSaveQuantity = async (productId: string) => {
    try {
      const updateData: any = {};
      
      if (quantityColumnKey === "quantity") {
        updateData.quantity = tempQuantity;
      } else {
        const product = products.find(p => p.id === productId);
        if (product) {
          updateData.data = {
            ...product.data,
            [quantityColumnKey]: tempQuantity,
          };
        }
      }

      const { error } = await supabase
        .from("dynamic_products")
        .update(updateData)
        .eq("id", productId);

      if (error) throw error;

      toast.success("Cantidad actualizada correctamente");
      setEditingQuantity(null);
    } catch (error) {
      console.error("Error updating quantity:", error);
      toast.error("Error al actualizar la cantidad");
    }
  };

  // Pagination
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return products.slice(startIndex, startIndex + itemsPerPage);
  }, [products, currentPage, itemsPerPage]);

  // Reset to page 1 when products change
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [products.length, totalPages]);

  return (
    <div className="border rounded-lg w-full">
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
          <ColumnConfigurationDialog listId={list.listId} columnSchema={list.columnSchema} />
          <ColumnSettingsDrawer listId={list.listId} columnSchema={list.columnSchema} />
        </div>
      </div>

      {isExpanded && (
        <>
          {effectiveViewMode === "cards" ? (
            <div className="p-4">
              <ProductCardView
                listId={list.listId}
                products={paginatedProducts}
                columnSchema={list.columnSchema}
                onAddToRequest={onAddToRequest}
                showActions={true}
              />
            </div>
          ) : (
          <div className="w-full border-t overflow-hidden">
            <div className="w-full overflow-x-auto">
              <div className="w-full overflow-y-auto max-h-[600px]">
                <div className="min-w-max">
                  <Table className="min-w-full">
              <TableHeader sticky>
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
                  paginatedProducts.map((product) => {
                    const quantity = getQuantityValue(product);
                    const isLowStock = quantity < threshold;

                    return (
                      <TableRow 
                        key={product.id}
                        className={cn(
                          isLowStock && "bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500"
                        )}
                      >
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

                          const isQuantityColumn = column.key === quantityColumnKey;
                          const isEditing = editingQuantity === product.id && isQuantityColumn;

                          return (
                            <TableCell key={column.key}>
                              {isQuantityColumn ? (
                                <div className="flex items-center gap-2">
                                  {isLowStock && (
                                    <Badge variant="destructive" className="text-xs">
                                      Bajo Stock
                                    </Badge>
                                  )}
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      value={tempQuantity}
                                      onChange={(e) => setTempQuantity(Number(e.target.value))}
                                      onBlur={() => handleSaveQuantity(product.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveQuantity(product.id);
                                        if (e.key === 'Escape') setEditingQuantity(null);
                                      }}
                                      autoFocus
                                      className="w-20 h-8"
                                    />
                                  ) : (
                                    <div
                                      onClick={() => handleStartEditing(product.id, quantity)}
                                      className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 min-w-[60px]"
                                      title="Click para editar"
                                    >
                                      {displayValue}
                                    </div>
                                  )}
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
          </div>
          )}
          
          {/* Pagination Controls */}
          {products.length > itemsPerPage && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, products.length)} de {products.length} productos
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
