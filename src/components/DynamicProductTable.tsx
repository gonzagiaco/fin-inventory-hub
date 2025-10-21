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
import { Button } from "@/components/ui/button";
import { Settings2, Search, ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useProductListStore } from "@/stores/productListStore";

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
  
  const { columnVisibility, setColumnVisibility } = useProductListStore();

  const columns = useMemo<ColumnDef<DynamicProduct>[]>(() => {
    const visibilityState = columnVisibility[listId] || {};
    
    return columnSchema
      .sort((a, b) => a.order - b.order)
      .map((schema) => ({
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
          visible: visibilityState[schema.key] !== false,
        },
      }));
  }, [columnSchema, listId, columnVisibility]);

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
    },
  });

  const handleColumnVisibilityChange = (columnKey: string, visible: boolean) => {
    setColumnVisibility(listId, columnKey, visible);
  };

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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Columnas
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">Visibilidad de columnas</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {columnSchema.map((schema) => {
                  const isVisible = columnVisibility[listId]?.[schema.key] !== false;
                  return (
                    <div key={schema.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`col-${schema.key}`}
                        checked={isVisible}
                        onCheckedChange={(checked) =>
                          handleColumnVisibilityChange(schema.key, checked as boolean)
                        }
                        disabled={schema.isStandard}
                      />
                      <label
                        htmlFor={`col-${schema.key}`}
                        className="text-sm flex-1 cursor-pointer"
                      >
                        {schema.label}
                        {schema.isStandard && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (fija)
                          </span>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <div className="border border-primary/20 rounded-lg overflow-x-auto">
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
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results info */}
      <div className="text-sm text-muted-foreground">
        Mostrando {table.getFilteredRowModel().rows.length} de {products.length}{" "}
        productos
      </div>
    </div>
  );
};
