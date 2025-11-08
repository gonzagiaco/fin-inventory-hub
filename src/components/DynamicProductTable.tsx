import { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { DynamicProduct, ColumnSchema } from "@/types/productList";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProductListStore } from "@/stores/productListStore";
import { ColumnSettingsDrawer } from "./ColumnSettingsDrawer";
import { cn } from "@/lib/utils";
import { ProductCardView } from "./ProductCardView";
import { Button } from "@/components/ui/button";
import { CardPreviewSettings } from "./CardPreviewSettings";
import { List, LayoutGrid, Loader2 } from "lucide-react";
import { QuantityCell } from "./stock/QuantityCell";
import { useIsMobile } from "@/hooks/use-mobile";

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

  const isMobile = useIsMobile();

  // Store (orden/visibilidad + modo de vista)
  const { columnVisibility, columnOrder, columnPinning, viewMode: storeViewMode, setViewMode } = useProductListStore();

  // Vista por defecto
  const shouldUseCardView = true;
  const defaultViewMode = !isMobile ? "table" : columnSchema.length < 8 ? "table" : "cards";
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

      // 🔸 Caso especial: columna de stock editable (reutiliza QuantityCell)
      if (schema.key === "quantity") {
        return {
          id: schema.key,
          accessorKey: "quantity",
          header: schema.label,
          cell: ({ row }) => (
            <QuantityCell
              productId={row.original.id}
              listId={listId}
              value={row.original.quantity}
              onLocalUpdate={(newQty) => {
                // update optimista local para reflejar de inmediato
                row.original.quantity = newQty;
              }}
            />
          ),
          meta: { isStandard: schema.isStandard, visible: isVisible },
        } as ColumnDef<DynamicProduct>;
      }

      // 🔹 Resto de columnas (tu lógica original)
      return {
        id: schema.key,
        accessorFn: (row: DynamicProduct) => {
          if (schema.key === "code") return row.code;
          if (schema.key === "name") return row.name;
          if (schema.key === "price") return row.price;
          if (schema.key === "quantity") return row.quantity;
          if (schema.key === "precio") return row.price;
          if (schema.key === "descripcion") return row.name;
          return row.data[schema.key];
        },
        header: schema.label,
        cell: ({ getValue }) => {
          const value = getValue();
          if (value === null || value === undefined) return "-";
          const isNumericField = schema.type === "number" || schema.key === "price";
          if (isNumericField && typeof value === "number") {
            return value.toFixed(2);
          }
          return String(value);
        },
        meta: {
          isStandard: schema.isStandard,
          visible: isVisible,
        },
      };
    });

    // Columna de acciones (agregar a pedido)
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
        meta: { visible: true },
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
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
      columnPinning: columnPinning[listId] || {},
    },
  });

  return (
    <div className="space-y-4">
      {/* Buscador + ajustes */}
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

      {/* Contenido: tarjetas o tabla */}
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
    </div>
  );
};
