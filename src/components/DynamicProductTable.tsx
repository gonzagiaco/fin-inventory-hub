import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { DynamicProduct, ColumnSchema } from "@/types/productList";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProductListStore } from "@/stores/productListStore";
import { ColumnSettingsDrawer } from "./ColumnSettingsDrawer";
import { cn } from "@/lib/utils";
import { ProductCardView } from "./ProductCardView";
import { Button } from "@/components/ui/button";
import { CardPreviewSettings } from "./CardPreviewSettings";
import { List, LayoutGrid, Loader2 } from "lucide-react";

interface DynamicProductTableProps {
  listId: string;
  products: DynamicProduct[];
  columnSchema: ColumnSchema[];
  onAddToRequest?: (product: DynamicProduct) => void;
  showStockActions?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export const DynamicProductTable = ({
  listId,
  products,
  columnSchema,
  onAddToRequest,
  showStockActions = false,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: DynamicProductTableProps) => {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const queryClient = useQueryClient();

  // Get column configuration and view mode from store
  const { columnVisibility, columnOrder, columnPinning, viewMode: storeViewMode, setViewMode } = useProductListStore();

  // Always allow card view with intelligent default
  const shouldUseCardView = true;
  const defaultViewMode = columnSchema.length > 8 ? "cards" : "table";
  const currentViewMode = storeViewMode[listId] || defaultViewMode;
  const effectiveViewMode = currentViewMode;

  const currentOrder = columnOrder[listId] || columnSchema.map((c) => c.key);
  const visibilityState = columnVisibility[listId] || {};

  const columns = useMemo<ColumnDef<DynamicProduct>[]>(() => {
    const orderedSchema = currentOrder
      .map((key) => columnSchema.find((c) => c.key === key))
      .filter(Boolean) as ColumnSchema[];

    const dataColumns = orderedSchema.map((schema) => {
      const isVisible = visibilityState[schema.key] !== false;
      if (schema.key === "quantity") {
        return {
          id: schema.key,
          accessorKey: "quantity", // seguimos exponiendo el valor de stock
          header: schema.label,
          cell: ({ row }) => {
            const prod = row.original;
            const current = Number(prod.quantity ?? 0);

            const handleCommit = async (raw: string) => {
              const newQty = Number(raw);
              if (Number.isNaN(newQty) || newQty === current) return;

              // 1) Actualiza BD (podés cambiar a tu RPC si preferís)
              const { error } = await supabase
                .from("dynamic_products_index")
                .update({ quantity: newQty })
                .eq("product_id", prod.id);

              if (error) {
                toast.error("Error al actualizar stock");
                return;
              }

              // 2) Update inmediato en UI
              row.original.quantity = newQty;

              // 3) Refrescar cache
              queryClient.invalidateQueries({ queryKey: ["list-products", listId] });

              toast.success("Stock actualizado");
            };

            const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                (e.target as HTMLInputElement).value = String(current);
                (e.target as HTMLInputElement).blur();
              }
            };

            return (
              <input
                type="number"
                className="h-8 w-24 bg-black border rounded px-2"
                defaultValue={current}
                onBlur={(e) => {
                  void handleCommit(e.target.value);
                }}
                onKeyDown={onKeyDown}
              />
            );
          },
          meta: { isStandard: schema.isStandard, visible: isVisible },
        } as ColumnDef<DynamicProduct>;
      }
      return {
        id: schema.key,
        accessorFn: (row: DynamicProduct) => {
          // Check standard fields first
          if (schema.key === "code") return row.code;
          if (schema.key === "name") return row.name;
          if (schema.key === "price") return row.price;
          if (schema.key === "quantity") return row.quantity;
          if (schema.key === "precio") return row.price;
          if (schema.key === "descripcion") return row.name;
          // Check data object
          return row.data[schema.key];
        },
        header: schema.label,
        cell: ({ getValue }) => {
          const value = getValue();
          if (value === null || value === undefined) return "-";
          if (schema.type === "number") {
            return typeof value === "number" ? value.toLocaleString() : value;
          }
          return String(value);
        },
        meta: {
          isStandard: schema.isStandard,
          visible: isVisible,
        },
      };
    });

    // Add actions column if showStockActions is true
    if (showStockActions && onAddToRequest) {
      dataColumns.unshift({
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => onAddToRequest(row.original)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        ),
        meta: {
          visible: true,
        },
      } as any);
    }

    return dataColumns;
  }, [columnSchema, listId, currentOrder, visibilityState, showStockActions, onAddToRequest]);

  const visibleColumns = useMemo(() => {
    return columns.filter((col) => {
      const meta = col.meta as any;
      return meta?.visible !== false;
    });
  }, [columns]);

  const table = useReactTable({
    data: products,
    columns: visibleColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    //getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
      columnPinning: columnPinning[listId] || {},
    },
    /*initialState: {
      pagination: {
        pageSize: 50,
      },
    },*/
  });

  return (
    <div className="space-y-4">
      {/* Search and Column Settings */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        {shouldUseCardView && (
          <div className="flex gap-2">
            <Button
              variant={effectiveViewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(listId, "table")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={effectiveViewMode === "cards" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(listId, "cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <CardPreviewSettings listId={listId} columnSchema={columnSchema} />
          </div>
        )}
        <ColumnSettingsDrawer listId={listId} columnSchema={columnSchema} />
      </div>

      {/* Content - Table or Card View */}
      {effectiveViewMode === "cards" ? (
        <ProductCardView
          listId={listId}
          products={table.getRowModel().rows.map((row) => row.original)}
          columnSchema={columnSchema}
          onAddToRequest={onAddToRequest}
          showActions={showStockActions}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
        />
      ) : (
        <div className="w-full border rounded-lg overflow-hidden">
          <div className="w-full overflow-x-auto">
            <div className="w-full overflow-y-auto max-h-[600px]">
              <div className="min-w-max">
                <Table className="min-w-full">
                  <TableHeader sticky>
                    <TableRow>
                      {table.getHeaderGroups()[0]?.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className="cursor-pointer select-none"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center gap-2">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: <ChevronUp className="w-4 h-4" />,
                              desc: <ChevronDown className="w-4 h-4" />,
                            }[header.column.getIsSorted() as string] ?? null}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground py-8">
                          No se encontraron productos
                        </TableCell>
                      </TableRow>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => {
                            const column = cell.column;
                            const meta = column.columnDef.meta as any;
                            const isHiddenButVisible = meta?.visible === false;

                            return (
                              <TableCell key={cell.id} className={cn(isHiddenButVisible && "opacity-30 bg-stripes")}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {effectiveViewMode === "table" && hasMore && (
                    <div className="text-center my-4">
                      <Button variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Cargando más...
                          </>
                        ) : (
                          "Ver más productos"
                        )}
                      </Button>
                    </div>
                  )}
                </Table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {/*
      {table.getFilteredRowModel().rows.length > 50 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Mostrando {table.getState().pagination.pageIndex * 50 + 1} a{" "}
            {Math.min((table.getState().pagination.pageIndex + 1) * 50, table.getFilteredRowModel().rows.length)} de{" "}
            {table.getFilteredRowModel().rows.length} productos
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {table.getState().pagination.pageIndex + 1} de{" "}
              {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      */}

      {/* Results info when no pagination needed */}
      {/*
      {table.getFilteredRowModel().rows.length <= 50 && (
        <div className="text-sm text-muted-foreground">
          Mostrando {table.getFilteredRowModel().rows.length} de {products.length} productos
        </div>
      )}
      */}
    </div>
  );
};
