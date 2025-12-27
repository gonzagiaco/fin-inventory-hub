import { useMemo, useState } from "react";
import { List, LayoutGrid, ChevronUp, ChevronDown, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuantityCell } from "./QuantityCell";
import { StockThresholdCell } from "./StockThresholdCell";
import { ProductCardView } from "@/components/ProductCardView";
import { ColumnSchema, DynamicProduct } from "@/types/productList";
import { normalizeRawPrice, formatARS } from "@/utils/numberParser";
import { removeFromMyStock } from "@/hooks/useMyStockProducts";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ColumnSettingsDrawer } from "@/components/ColumnSettingsDrawer";
import { CardPreviewSettings } from "@/components/CardPreviewSettings";
import { useProductListStore } from "@/stores/productListStore";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";

interface MyStockListProductsProps {
  listId: string;
  products: any[];
  columnSchema: ColumnSchema[];
  mappingConfig: any;
  onAddToRequest: (product: any, mappingConfig?: any) => void;
  onQuantityChange?: (productId: string, newQuantity: number) => void;
  onThresholdChange?: (productId: string, newThreshold: number) => void;
  onRemoveProduct?: (productId: string) => void;
  isMobile: boolean;
}

const STOCK_THRESHOLD_COLUMN: ColumnSchema = {
  key: "stock_threshold",
  label: "Stock Mínimo",
  type: "number",
  visible: true,
  order: 0,
  isStandard: true,
};

export function MyStockListProducts({
  listId,
  products,
  columnSchema,
  mappingConfig,
  onAddToRequest,
  onQuantityChange,
  onThresholdChange,
  onRemoveProduct,
  isMobile,
}: MyStockListProductsProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const { columnVisibility, columnOrder, viewMode: storeViewMode, setViewMode } = useProductListStore();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  // Default view mode
  const defaultViewMode = isMobile ? "cards" : "table";
  const currentViewMode = storeViewMode[listId] || defaultViewMode;

  // Handler para quitar de Mi Stock - persist to IndexedDB BEFORE UI update
  const handleRemoveFromStock = async (product: any) => {
    const productId = product.product_id || product.id;
    const productListId = product.list_id || listId;
    
    try {
      // 1. FIRST: Persist to IndexedDB (critical for offline persistence)
      await removeFromMyStock(productId, productListId, isOnline);
      
      // 2. THEN: Update UI optimistically
      onRemoveProduct?.(productId);
      
      // 3. Toast feedback
      toast.success("Producto quitado de Mi Stock");
      
      // 4. Invalidate queries in background
      queueMicrotask(() => {
        queryClient.invalidateQueries({ queryKey: ["my-stock"] });
      });
    } catch (error) {
      console.error("Error al quitar de Mi Stock:", error);
      toast.error("Error al quitar producto");
    }
  };

  // Handler para actualizar cantidad (optimista)
  const handleQuantityChange = (productId: string, newQuantity: number) => {
    onQuantityChange?.(productId, newQuantity);
  };

  const handleThresholdChange = (productId: string, newThreshold: number) => {
    onThresholdChange?.(productId, newThreshold);
  };

  // Process schema: only mark quantity as isStandard (fixed)
  const processedSchema: ColumnSchema[] = useMemo(() => {
    const hasThreshold = columnSchema.some((col) => col.key === STOCK_THRESHOLD_COLUMN.key);
    const baseSchema = hasThreshold
      ? columnSchema
      : (() => {
          const quantityIndex = columnSchema.findIndex((col) => col.key === "quantity");
          const insertAt = quantityIndex >= 0 ? quantityIndex + 1 : columnSchema.length;
          const nextSchema = [...columnSchema];
          nextSchema.splice(insertAt, 0, STOCK_THRESHOLD_COLUMN);
          return nextSchema;
        })();

    return baseSchema.map((col, index) => ({
      ...col,
      isStandard: col.key === "quantity" || col.key === STOCK_THRESHOLD_COLUMN.key,
      order: col.order ?? index,
    }));
  }, [columnSchema]);

  // Column order: default puts quantity second (after actions)
  const schemaKeys = useMemo(() => processedSchema.map((c) => c.key), [processedSchema]);
  
  const currentOrder = useMemo(() => {
    const saved = columnOrder[listId];
    
    if (!saved || saved.length === 0) {
      // Default order: quantity, stock_threshold, then the rest
      const withoutFixed = schemaKeys.filter(
        (key) => key !== "quantity" && key !== STOCK_THRESHOLD_COLUMN.key,
      );
      return ["quantity", STOCK_THRESHOLD_COLUMN.key, ...withoutFixed];
    }
    
    // Add any new columns that aren't in saved order
    const extra = schemaKeys.filter((key) => !saved.includes(key));
    return [...saved, ...extra];
  }, [columnOrder, listId, schemaKeys]);

  const visibilityState = columnVisibility[listId] || {};

  // Sorting state for cards
  const sortColumn = sorting.length > 0 ? sorting[0].id : null;
  const sortDirection = sorting.length > 0 ? (sorting[0].desc ? 'desc' : 'asc') : null;

  const handleSortChange = (columnKey: string | null, direction: 'asc' | 'desc' | null) => {
    if (columnKey === null || direction === null) {
      setSorting([]);
    } else {
      setSorting([{ id: columnKey, desc: direction === 'desc' }]);
    }
  };

  // Build columns for TanStack Table
  const columns = useMemo<ColumnDef<any>[]>(() => {
    const orderedSchema = currentOrder
      .map((key) => processedSchema.find((c) => c.key === key))
      .filter(Boolean) as ColumnSchema[];

    const dataColumns: ColumnDef<any>[] = [];

    // Actions column at the start (remove + add to cart)
    dataColumns.push({
      id: "actions",
      header: "Acciones",
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => handleRemoveFromStock(row.original)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddToRequest(row.original, mappingConfig)}
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </div>
      ),
      meta: { visible: true },
    } as any);

    // Data columns
    orderedSchema.forEach((schema) => {
      const isVisible = visibilityState[schema.key] !== false;

      // Special case: quantity column with editable input
      if (schema.key === "quantity") {
        dataColumns.push({
          id: schema.key,
          accessorKey: "quantity",
          header: schema.label,
          cell: ({ row }: any) => {
            const quantity = row.original.quantity || 0;
            const stockThreshold = row.original.stock_threshold ?? 0;
            const isLowStock = stockThreshold > 0 && quantity < stockThreshold;

            return (
              <div className="flex items-center gap-2">
                {isLowStock && (
                  <Badge variant="destructive" className="text-xs">
                    Bajo Stock
                  </Badge>
                )}
                <QuantityCell
                  productId={row.original.product_id || row.original.id}
                  listId={row.original.list_id || listId}
                  value={row.original.quantity}
                  visibleSpan={false}
                  onOptimisticUpdate={(newQty) => handleQuantityChange(row.original.product_id || row.original.id, newQty)}
                />
              </div>
            );
          },
          meta: { isStandard: true, visible: isVisible },
        } as ColumnDef<any>);
        return;
      }

      if (schema.key === STOCK_THRESHOLD_COLUMN.key) {
        dataColumns.push({
          id: schema.key,
          accessorKey: "stock_threshold",
          header: schema.label,
          cell: ({ row }: any) => (
            <StockThresholdCell
              productId={row.original.product_id || row.original.id}
              listId={row.original.list_id || listId}
              value={row.original.stock_threshold}
              onOptimisticUpdate={(newThreshold) =>
                handleThresholdChange(row.original.product_id || row.original.id, newThreshold)
              }
            />
          ),
          meta: { isStandard: true, visible: isVisible },
        } as ColumnDef<any>);
        return;
      }

      // Other columns
      dataColumns.push({
        id: schema.key,
        accessorFn: (row: any) => {
          // Price primary key from mapping
          if (mappingConfig?.price_primary_key && schema.key === mappingConfig.price_primary_key) {
            return row.price;
          }
          // Calculated data overrides
          if (row.calculated_data && schema.key in row.calculated_data) {
            return row.calculated_data[schema.key];
          }
          // Standard mappings
          if (schema.key === "code") return row.code;
          if (schema.key === "name") return row.name;
          if (schema.key === "price") return row.price;
          // Custom columns from data
          return row.data?.[schema.key];
        },
        header: schema.label,
        cell: ({ getValue }: any) => {
          const value = getValue();
          if (value === null || value === undefined) return "-";

          const key = schema.key.toLowerCase();
          const priceKeys = [
            "price",
            "precio",
            mappingConfig?.price_primary_key?.toLowerCase(),
            ...(mappingConfig?.price_alt_keys?.map((k: string) => k.toLowerCase()) || []),
          ].filter(Boolean);
          const isPriceField = priceKeys.includes(key) || key.includes("precio") || key.includes("price");

          if (isPriceField || schema.type === "number") {
            const numericValue = normalizeRawPrice(value);
            if (numericValue !== null) {
              return formatARS(numericValue);
            }
          }

          return String(value);
        },
        meta: { isStandard: schema.isStandard, visible: isVisible },
      } as ColumnDef<any>);
    });

    return dataColumns;
  }, [processedSchema, currentOrder, visibilityState, mappingConfig, onAddToRequest, listId]);

  const visibleColumns = useMemo(() => {
    return columns.filter((col) => {
      const meta = col.meta as any;
      return meta?.visible !== false;
    });
  }, [columns]);

  // Transform products for card view
  const transformedProducts: DynamicProduct[] = useMemo(() => {
    return products.map((p) => ({
      id: p.product_id || p.id,
      listId: p.list_id || listId,
      code: p.code,
      name: p.name,
      price: p.price,
      quantity: p.quantity,
      stock_threshold: p.stock_threshold ?? 0,
      in_my_stock: true,
      data: p.data || {},
      calculated_data: p.calculated_data || {},
      supplierId: p.supplierId,
      mappingConfig,
    }));
  }, [products, mappingConfig, listId]);

  const table = useReactTable({
    data: products,
    columns: visibleColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  if (products.length === 0) {
    return (
      <div className="p-6 text-center border-t text-muted-foreground">
        No hay productos con stock en esta lista
      </div>
    );
  }

  const ViewToggle = () => (
    <div className="flex gap-1.5">
      {!isMobile && (
        <Button
          variant={currentViewMode === "table" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode(listId, "table")}
        >
          <List className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant={currentViewMode === "cards" ? "default" : "outline"}
        size="sm"
        onClick={() => setViewMode(listId, "cards")}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );

  if (currentViewMode === "cards") {
    return (
      <div className="p-4 border-t">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div className="flex gap-1.5">
            <CardPreviewSettings
              listId={listId}
              columnSchema={processedSchema}
              fixedKeys={["quantity", STOCK_THRESHOLD_COLUMN.key]}
            />
            <ColumnSettingsDrawer listId={listId} columnSchema={processedSchema} mappingConfig={mappingConfig} />
          </div>
          <ViewToggle />
        </div>
        <ProductCardView
          listId={listId}
          products={table.getRowModel().rows.map((row) => row.original as any)}
          columnSchema={processedSchema}
          mappingConfig={mappingConfig}
          onAddToRequest={(product) => onAddToRequest(product, mappingConfig)}
          showActions={true}
          showRemoveFromStock={true}
          onRemoveFromStock={handleRemoveFromStock}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          showLowStockBadge={true}
          showStockThreshold={true}
          onThresholdChange={handleThresholdChange}
        />
      </div>
    );
  }

  return (
    <div className="p-4 border-t">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex gap-1.5">
          <CardPreviewSettings
            listId={listId}
            columnSchema={processedSchema}
            fixedKeys={["quantity", STOCK_THRESHOLD_COLUMN.key]}
          />
          <ColumnSettingsDrawer listId={listId} columnSchema={processedSchema} mappingConfig={mappingConfig} />
        </div>
        <ViewToggle />
      </div>

      <div className="w-full border rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-auto relative">
          <Table className="min-w-full">
            <TableHeader>
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
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
