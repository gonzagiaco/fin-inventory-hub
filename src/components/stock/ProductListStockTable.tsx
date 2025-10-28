import { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ShoppingCart, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListProducts } from "@/hooks/useListProducts";
import { ColumnSettingsDrawer } from "@/components/ColumnSettingsDrawer";
import { useProductListStore } from "@/stores/productListStore";
import { ProductCardView } from "@/components/ProductCardView";
import { CardPreviewSettings } from "@/components/CardPreviewSettings";
import { ColumnConfigurationDialog } from "@/components/ColumnConfigurationDialog";
import { List, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ColumnSchema } from "@/types/productList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProductListStockTableProps {
  listId: string;
  listName: string;
  columnSchema: ColumnSchema[];
  mappingConfig: any;
  onAddToRequest: (product: any) => void;
}

export function ProductListStockTable({ 
  listId, 
  listName,
  columnSchema,
  mappingConfig,
  onAddToRequest 
}: ProductListStockTableProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [quantityFilter, setQuantityFilter] = useState<string>("all");
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [tempQuantity, setTempQuantity] = useState<number>(0);
  const [sorting, setSorting] = useState<SortingState>([]);

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage,
    isFetchingNextPage 
  } = useListProducts(listId, searchQuery);

  const allProducts = useMemo(() => 
    (data?.pages ?? []).flatMap(page => page.data ?? []),
    [data]
  );

  const totalCount = data?.pages[0]?.count ?? 0;

  const products = useMemo(() => {
    let filtered = allProducts.map(indexProduct => ({
      id: indexProduct.product_id,
      listId: indexProduct.list_id,
      code: indexProduct.code,
      name: indexProduct.name,
      price: indexProduct.price,
      quantity: indexProduct.quantity,
      data: {},
    }));

    if (quantityFilter !== "all") {
      filtered = filtered.filter(p => {
        const qty = p.quantity || 0;
        if (quantityFilter === "low") return qty < 50;
        if (quantityFilter === "medium") return qty >= 50 && qty < 100;
        if (quantityFilter === "high") return qty >= 100;
        return true;
      });
    }

    return filtered;
  }, [allProducts, quantityFilter]);

  const {
    columnVisibility,
    columnOrder,
    viewMode: storeViewMode,
    setViewMode,
    quantityColumn,
    lowStockThreshold,
  } = useProductListStore();

  const defaultViewMode = columnSchema.length > 8 ? "cards" : "table";
  const currentViewMode = storeViewMode[listId] || defaultViewMode;
  const effectiveViewMode = currentViewMode;

  const visibilityState = columnVisibility[listId] || {};
  const currentOrder = columnOrder[listId] || columnSchema.map((col) => col.key);

  const visibleColumns = currentOrder
    .map((key) => columnSchema.find((col) => col.key === key))
    .filter(
      (col): col is (typeof columnSchema)[number] => col !== undefined && visibilityState[col.key] !== false,
    );

  const quantityColumnKey = quantityColumn[listId] || "quantity";
  const threshold = lowStockThreshold[listId] || 50;

  const getQuantityValue = (product: any): number => {
    return Number(product.quantity) || 0;
  };

  const lowStockCount = products.filter((p) => getQuantityValue(p) < threshold).length;

  const handleStartEditing = (productId: string, currentQty: number) => {
    setEditingQuantity(productId);
    setTempQuantity(currentQty);
  };

  const handleSaveQuantity = async (productId: string) => {
    try {
      const { error: productError } = await supabase
        .from("dynamic_products")
        .update({ quantity: tempQuantity })
        .eq("id", productId);
      
      if (productError) throw productError;
      
      const { error: indexError } = await (supabase as any)
        .from("dynamic_products_index")
        .update({ quantity: tempQuantity })
        .eq("product_id", productId);
      
      if (indexError) throw indexError;
      
      queryClient.invalidateQueries({ queryKey: ['list-products', listId] });
      
      toast.success("Cantidad actualizada correctamente");
      setEditingQuantity(null);
    } catch (error) {
      console.error("Error updating quantity:", error);
      toast.error("Error al actualizar la cantidad");
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => {
    return visibleColumns.map((col) => ({
      id: col.key,
      accessorFn: (row: any) => {
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

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedRows = useMemo(() => table.getSortedRowModel().rows, [table]);

  return (
    <div className="border rounded-lg w-full">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 p-4 bg-muted/50">
        <div className="flex items-center gap-3 w-full lg:flex-1">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{listName}</h3>
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

        <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
          <div className="flex gap-2">
            <Button
              variant={effectiveViewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(listId, "table")}
              title="Vista de tabla"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={effectiveViewMode === "cards" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(listId, "cards")}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <CardPreviewSettings listId={listId} columnSchema={columnSchema} />
          </div>
          <ColumnConfigurationDialog listId={listId} columnSchema={columnSchema} />
          <ColumnSettingsDrawer listId={listId} columnSchema={columnSchema} />
        </div>
      </div>

      <>
        <div className="p-4 border-b space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Buscar en esta lista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Select value={quantityFilter} onValueChange={setQuantityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low">Bajo (&lt; 50)</SelectItem>
                  <SelectItem value="medium">Medio (50-100)</SelectItem>
                  <SelectItem value="high">Alto (&gt; 100)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Mostrando {products.length} de {totalCount} productos
            </p>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Cargando productos...</p>
            </div>
          ) : effectiveViewMode === "cards" ? (
            <div className="p-4">
              <ProductCardView
                listId={listId}
                products={products}
                columnSchema={columnSchema}
                onAddToRequest={onAddToRequest}
                showActions={true}
                onLoadMore={() => fetchNextPage()}
                hasMore={hasNextPage}
                isLoadingMore={isFetchingNextPage}
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
                      {sortedRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={visibleColumns.length + 1} className="text-center text-muted-foreground">
                            No hay productos en esta lista
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedRows.map((row) => {
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
                                            {quantity}
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

          {hasNextPage && (
            <div className="p-4 border-t text-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>Cargar más productos</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                {products.length} de {totalCount} cargados
              </p>
            </div>
          )}
      </>
    </div>
  );
}
