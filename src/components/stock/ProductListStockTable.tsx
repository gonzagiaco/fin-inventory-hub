import { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ShoppingCart, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export function ProductListStockTable({ list, products, onAddToRequest }: ProductListStockTableProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  const itemsPerPage = 50;

  // Debug sorting
  useEffect(() => {
    if (sorting.length > 0) {
      console.log("🔄 Sorting changed:", sorting);
    }
  }, [sorting]);

  const {
    columnVisibility,
    columnOrder,
    viewMode: storeViewMode,
    setViewMode,
    quantityColumn,
    lowStockThreshold,
  } = useProductListStore();

  const shouldUseCardView = true; // Always allow card view
  const defaultViewMode = list.columnSchema.length > 8 ? "cards" : "table";
  const currentViewMode = storeViewMode[list.listId] || defaultViewMode;
  const effectiveViewMode = currentViewMode;

  const visibilityState = columnVisibility[list.listId] || {};
  const currentOrder = columnOrder[list.listId] || list.columnSchema.map((col) => col.key);

  const visibleColumns = currentOrder
    .map((key) => list.columnSchema.find((col) => col.key === key))
    .filter(
      (col): col is (typeof list.columnSchema)[number] => col !== undefined && visibilityState[col.key] !== false,
    );

  const quantityColumnKey = quantityColumn[list.listId] || "quantity";
  const threshold = lowStockThreshold[list.listId] || 50;

  const getQuantityValue = (product: EnrichedProduct): number => {
    const value = quantityColumnKey === "quantity" ? product.quantity : product.data?.[quantityColumnKey];
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
        const product = products.find((p) => p.id === productId);
        if (product) {
          updateData.data = {
            ...product.data,
            [quantityColumnKey]: tempQuantity,
          };
        }
      }

      const { error } = await supabase.from("dynamic_products").update(updateData).eq("id", productId);

      if (error) throw error;

      toast.success("Cantidad actualizada correctamente");
      setEditingQuantity(null);
    } catch (error) {
      console.error("Error updating quantity:", error);
      toast.error("Error al actualizar la cantidad");
    }
  };

  const columns = useMemo<ColumnDef<EnrichedProduct>[]>(() => {
    return visibleColumns.map((col) => ({
      id: col.key,
      accessorFn: (row: EnrichedProduct) => {
        if (col.key === "code") return row.code;
        if (col.key === "name") return row.name;
        if (col.key === "price") return row.price;
        if (col.key === "quantity") return row.quantity;
        return row.data[col.key];
      },
      header: col.label,
      enableSorting: true,
      sortingFn: (rowA, rowB, columnId) => {
        const va = rowA.getValue(columnId) ?? "";
        const vb = rowB.getValue(columnId) ?? "";
        // Comparación numérica o alfabética
        if (!isNaN(Number(va)) && !isNaN(Number(vb))) return Number(va) - Number(vb);
        return String(va).localeCompare(String(vb), "es", { sensitivity: "base" });
      },
      cell: (info) => {
        const value = info.getValue();
        if (value == null) return "-";
        if (col.type === "number") return Number(value).toLocaleString("es-AR");
        if (col.type === "date") return value instanceof Date ? value.toLocaleDateString("es-AR") : String(value);
        return String(value);
      },
    }));
  }, [visibleColumns]);

  // Initialize table
  const table = useReactTable({
    data: products,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Pagination
  const totalPages = Math.ceil(table.getRowModel().rows.length / itemsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return table.getRowModel().rows.slice(start, start + itemsPerPage);
  }, [table, currentPage, itemsPerPage]);

  return (
    <div className="border rounded-lg w-full">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 p-4 bg-muted/50">
        {/* Primera línea en mobile: botón colapsar + info */}
        <div className="flex items-center gap-3 w-full lg:flex-1">
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="shrink-0">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{list.listName}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
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
        </div>
        
        {/* Segunda línea en mobile: controles */}
        <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
          <div className="flex gap-2">
            <Button
              variant={effectiveViewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(list.listId, "table")}
              title="Vista de tabla"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={effectiveViewMode === "cards" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(list.listId, "cards")}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <CardPreviewSettings listId={list.listId} columnSchema={list.columnSchema} />
          </div>
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
                products={products}
                columnSchema={list.columnSchema}
                onAddToRequest={onAddToRequest}
                showActions={true}
              />
            </div>
          ) : (
            <div className="w-full border-t">
              <div className="w-full overflow-x-auto">
                <div className="w-full overflow-y-auto max-h-[600px]">
                  <Table className="min-w-full">
                    <TableHeader sticky>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead
                              key={header.id}
                              onClick={header.column.getToggleSortingHandler()}
                              className="cursor-pointer select-none bg-background"
                            >
                              <div className="flex items-center gap-1">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {{
                                  asc: <ChevronUp className="w-4 h-4" />,
                                  desc: <ChevronDown className="w-4 h-4" />,
                                }[header.column.getIsSorted() as string] ?? null}
                              </div>
                            </TableHead>
                          ))}
                          <TableHead className="text-right bg-background">Acciones</TableHead>
                        </TableRow>
                      ))}
                    </TableHeader>

                    <TableBody>
                      {paginatedRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={visibleColumns.length + 1}
                            className="text-center text-muted-foreground"
                          >
                            No hay productos en esta lista
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedRows.map((row) => {
                          const product = row.original;
                          const quantity = getQuantityValue(product);
                          const isLowStock = quantity < threshold;

                          return (
                            <TableRow
                              key={row.id}
                              className={cn(isLowStock && "dark:bg-red-950/20 border-l-4 border-red-500")}
                            >
                              {row.getVisibleCells().map((cell) => {
                                const columnKey = cell.column.id;
                                const isQuantityColumn = columnKey === quantityColumnKey;
                                const isEditing = editingQuantity === product.id && isQuantityColumn;
                                const displayValue = flexRender(cell.column.columnDef.cell, cell.getContext());

                                return (
                                  <TableCell key={cell.id}>
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
                                              if (e.key === "Enter") handleSaveQuantity(product.id);
                                              if (e.key === "Escape") setEditingQuantity(null);
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
                                <Button size="sm" variant="outline" onClick={() => onAddToRequest(product)}>
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
          )}

          {/* Pagination */}
          {table.getRowModel().rows.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                {Math.min(currentPage * itemsPerPage, table.getRowModel().rows.length)} de{" "}
                {table.getRowModel().rows.length} productos
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Anterior</span>
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <span className="hidden sm:inline mr-1">Siguiente</span>
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
