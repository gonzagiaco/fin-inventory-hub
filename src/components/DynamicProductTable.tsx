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
import { DynamicProduct, ColumnSchema, ProductList } from "@/types/productList";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProductListStore } from "@/stores/productListStore";
import { ColumnSettingsDrawer } from "./ColumnSettingsDrawer";
import { cn } from "@/lib/utils";
import { ProductCardView } from "./ProductCardView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardPreviewSettings } from "./CardPreviewSettings";
import { List, LayoutGrid, Loader2 } from "lucide-react";
import { QuantityCell } from "./stock/QuantityCell";
import { useIsMobile } from "@/hooks/use-mobile";

interface DynamicProductTableProps {
  listId: string;
  products: DynamicProduct[];
  columnSchema: ColumnSchema[];
  mappingConfig?: ProductList["mapping_config"];
  onAddToRequest?: (product: DynamicProduct, mappingConfig?: ProductList["mapping_config"]) => void;
  showStockActions?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export const DynamicProductTable = ({
  listId,
  products,
  columnSchema,
  mappingConfig,
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
  const defaultViewMode = isMobile ? "cards" : columnSchema.length > 8 ? "cards" : "table";
  const currentViewMode = storeViewMode[listId] || defaultViewMode;
  const effectiveViewMode = currentViewMode;

  const schemaKeys = useMemo(() => columnSchema.map((c) => c.key), [columnSchema]);

  // Orden efectivo: respeta lo guardado, pero agrega al final las nuevas keys
  const currentOrder = useMemo(() => {
    const saved = columnOrder[listId];

    // Si no hay orden guardado, usar directamente el schema actual
    if (!saved || saved.length === 0) {
      return schemaKeys;
    }

    // Agregar cualquier columna nueva que no esté en el orden guardado
    const extra = schemaKeys.filter((key) => !saved.includes(key));

    return [...saved, ...extra];
  }, [columnOrder, listId, schemaKeys]);

  const visibilityState = columnVisibility[listId] || {};

  const columns = useMemo<ColumnDef<DynamicProduct>[]>(() => {
    const orderedSchema = currentOrder
      .map((key) => columnSchema.find((c) => c.key === key))
      .filter(Boolean) as ColumnSchema[];

    const dataColumns = orderedSchema.map((schema) => {
      const isVisible = visibilityState[schema.key] !== false;

      // Caso especial: columna de stock editable (reutiliza QuantityCell)
      if (schema.key === "quantity") {
        return {
          id: schema.key,
          accessorKey: "quantity",
          header: schema.label,
          cell: ({ row }) => {
            const quantity = row.original.quantity || 0;
            const lowStockThreshold = mappingConfig?.low_stock_threshold || 50;
            const isLowStock = quantity < lowStockThreshold;

            return (
              <div className="flex items-center gap-2">
                {isLowStock && (
                  <Badge variant="destructive" className="text-xs">
                    Bajo Stock
                  </Badge>
                )}
                <QuantityCell
                  productId={row.original.id}
                  listId={listId}
                  value={row.original.quantity}
                  onLocalUpdate={(newQty) => {
                    row.original.quantity = newQty;
                  }}
                  visibleSpan={false}
                />
              </div>
            );
          },
          meta: { isStandard: schema.isStandard, visible: isVisible },
        } as ColumnDef<DynamicProduct>;
      }

      // 🔹 Resto de columnas (tu lógica original)
      return {
        id: schema.key,
        accessorFn: (row: DynamicProduct) => {
          // PRIMERO: Si esta columna es la columna de precio principal configurada
          if (mappingConfig?.price_primary_key && schema.key === mappingConfig.price_primary_key) {
            return row.price; // Precio calculado del índice con modificadores generales
          }

          // SEGUNDO: Si esta columna tiene un override específico
          if (row.calculated_data && schema.key in row.calculated_data) {
            return row.calculated_data[schema.key]; // Precio con override específico
          }

          // TERCERO: Mapeos estándar de campos conocidos
          if (schema.key === "code") return row.code;
          if (schema.key === "name") return row.name;
          if (schema.key === "price") return row.price; // Fallback para "price" estándar
          if (schema.key === "quantity") return row.quantity;
          if (schema.key === "precio") return row.price;
          if (schema.key === "descripcion") return row.name;

          // CUARTO: Para columnas custom sin mapeo especial, leer de data original
          return row.data[schema.key];
        },
        header: schema.label,
        cell: ({ getValue, row }) => {
          const value = getValue();
          if (value === null || value === undefined) return "-";

          const key = schema.key.toLowerCase();

          const isNumericField =
            schema.type === "number" ||
            key === "price" ||
            key === "precio" ||
            key.includes("precio") ||
            key.includes("price");

          if (isNumericField) {
            // si viene como número, lo usamos directo
            // si viene como string numérico, lo convertimos
            const numericValue =
              typeof value === "number"
                ? value
                : typeof value === "string" &&
                    value.trim() !== "" &&
                    !isNaN(Number(value.replace(/\./g, "").replace(",", ".")))
                  ? Number(value.replace(/\./g, "").replace(",", "."))
                  : null;

            if (numericValue !== null) {
              const formattedValue = new Intl.NumberFormat("es-AR", {
                style: "currency",
                currency: "ARS",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(numericValue);

              return <div className="flex items-center gap-1.5">{formattedValue}</div>;
            }
          }

          // fallback para columnas no numéricas o valores no convertibles
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
          <Button size="sm" variant="outline" onClick={() => onAddToRequest(row.original, mappingConfig)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        ),
        meta: { visible: true },
      } as any);
    }

    return dataColumns;
  }, [columnSchema, listId, currentOrder, visibilityState, showStockActions, onAddToRequest, mappingConfig]);

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
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {shouldUseCardView && (
            <>
              <Button
                variant={effectiveViewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(listId, "table")}
                className="flex-shrink-0"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={effectiveViewMode === "cards" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(listId, "cards")}
                className="flex-shrink-0"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <CardPreviewSettings listId={listId} columnSchema={columnSchema} />
            </>
          )}
          <ColumnSettingsDrawer listId={listId} columnSchema={columnSchema} />
        </div>
      </div>

      {/* Contenido: tarjetas o tabla */}
      {effectiveViewMode === "cards" ? (
        <ProductCardView
          listId={listId}
          products={table.getRowModel().rows.map((row) => row.original)}
          columnSchema={columnSchema}
          mappingConfig={mappingConfig}
          onAddToRequest={onAddToRequest}
          showActions={showStockActions}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
        />
      ) : (
        <div className="w-full border rounded-lg overflow-hidden">
          {/* Contenedor scrolleable: acá vive el sticky */}
          <div className="max-h-[600px] overflow-auto">
            <Table className="min-w-full">
              <TableHeader className="sticky top-0 safe-top-fixed z-20 bg-background shadow-sm">
                <TableRow>
                  {table.getHeaderGroups()[0]?.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="cursor-pointer select-none bg-background"
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
            </Table>

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
          </div>
        </div>
      )}
    </div>
  );
};
