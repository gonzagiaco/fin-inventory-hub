import { useState, useMemo } from "react";
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
import { DynamicProduct, ColumnSchema } from "@/types/productList";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProductListStore } from "@/stores/productListStore";
import { ColumnSettingsDrawer } from "./ColumnSettingsDrawer";
import { cn } from "@/lib/utils";
import { ProductCardView } from "./ProductCardView";
import { Button } from "@/components/ui/button";
import { CardPreviewSettings } from "./CardPreviewSettings";
import { List, LayoutGrid } from "lucide-react";

interface DynamicProductTableProps {
  listId: string;
  products: DynamicProduct[];
  columnSchema: ColumnSchema[];
}

export const DynamicProductTable = ({
  listId,
  products,
  columnSchema,
}: DynamicProductTableProps) => {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  
  // Get column configuration and view mode from store
  const { 
    columnVisibility, 
    columnOrder, 
    columnPinning,
    viewMode: storeViewMode,
    setViewMode
  } = useProductListStore();

  // Determine if we should use card view based on column count
  const shouldUseCardView = columnSchema.length > 8;
  const currentViewMode = storeViewMode[listId] || "table";
  const effectiveViewMode = shouldUseCardView ? currentViewMode : "table";

  const currentOrder = columnOrder[listId] || columnSchema.map((c) => c.key);
  const visibilityState = columnVisibility[listId] || {};

  const columns = useMemo<ColumnDef<DynamicProduct>[]>(() => {
    const orderedSchema = currentOrder
      .map((key) => columnSchema.find((c) => c.key === key))
      .filter(Boolean) as ColumnSchema[];

    return orderedSchema.map((schema) => {
      const isVisible = visibilityState[schema.key] !== false;
      
      return {
        id: schema.key,
        accessorFn: (row: DynamicProduct) => {
          // Check standard fields first
          if (schema.key === 'code') return row.code;
          if (schema.key === 'name') return row.name;
          if (schema.key === 'price') return row.price;
          if (schema.key === 'quantity') return row.quantity;
          // Check data object
          return row.data[schema.key];
        },
        header: schema.label,
        cell: ({ getValue }) => {
          const value = getValue();
          if (value === null || value === undefined) return "-";
          if (schema.type === 'number') {
            return typeof value === 'number' ? value.toLocaleString() : value;
          }
          return String(value);
        },
        meta: {
          isStandard: schema.isStandard,
          visible: isVisible,
        },
      };
    });
  }, [columnSchema, listId, currentOrder, visibilityState]);

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
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
      columnPinning: columnPinning[listId] || {},
    },
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
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
        />
      ) : (
        <div className="border rounded-lg">
          <div className="overflow-x-auto">
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
            <TableHeader sticky>
              <TableRow>
                {table.getHeaderGroups()[0]?.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
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
                  <TableCell
                    colSpan={visibleColumns.length}
                    className="text-center text-muted-foreground py-8"
                  >
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
                        <TableCell
                          key={cell.id}
                          className={cn(
                            isHiddenButVisible &&
                              "opacity-30 bg-stripes"
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
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

      {/* Results info when no pagination needed */}
      {table.getFilteredRowModel().rows.length <= 50 && (
        <div className="text-sm text-muted-foreground">
          Mostrando {table.getFilteredRowModel().rows.length} de {products.length} productos
        </div>
      )}
    </div>
  );
};
