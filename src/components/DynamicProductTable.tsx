import { useState, useMemo } from "react";
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
import { Search, ChevronDown, ChevronUp } from "lucide-react";
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
import { LayoutGrid, List } from "lucide-react";

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
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  
  const { columnVisibility, columnOrder, columnPinning } = useProductListStore();

  // Automatically switch to card view if many columns
  const shouldUseCardView = columnSchema.length > 8;
  const effectiveViewMode = shouldUseCardView ? viewMode : "table";

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
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              variant={effectiveViewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={effectiveViewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        )}
        <ColumnSettingsDrawer listId={listId} columnSchema={columnSchema} />
      </div>

      {/* Content - Table or Card View */}
      {effectiveViewMode === "cards" ? (
        <ProductCardView
          products={table.getFilteredRowModel().rows.map((row) => row.original)}
          columnSchema={columnSchema}
        />
      ) : (
        <div className="border border-primary/20 rounded-lg overflow-x-auto max-h-[600px]">
          <Table>
            <TableHeader>
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
      )}

      {/* Results info */}
      <div className="text-sm text-muted-foreground">
        Mostrando {table.getFilteredRowModel().rows.length} de {products.length}{" "}
        productos
      </div>
    </div>
  );
};
