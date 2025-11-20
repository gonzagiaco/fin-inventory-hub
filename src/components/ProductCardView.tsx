import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, ShoppingCart, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DynamicProduct, ColumnSchema, ProductList } from "@/types/productList";
import { Loader2 } from "lucide-react";
import { useProductListStore } from "@/stores/productListStore";
import { QuantityCell } from "./stock/QuantityCell";
import { normalizeRawPrice, formatARS } from "@/utils/numberParser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProductCardViewProps {
  listId: string;
  products: DynamicProduct[] | any[];
  columnSchema: ColumnSchema[];
  mappingConfig?: ProductList["mapping_config"];
  onAddToRequest?: (product: any, mappingConfig?: ProductList["mapping_config"]) => void;
  showActions?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
  onSortChange?: (columnKey: string | null, direction: 'asc' | 'desc' | null) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export function ProductCardView({
  listId,
  products,
  columnSchema,
  mappingConfig,
  onAddToRequest,
  showActions = false,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  sortColumn: externalSortColumn,
  sortDirection: externalSortDirection,
  onSortChange,
}: ProductCardViewProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(10);
  const { cardPreviewFields } = useProductListStore();

  // Usar estado externo si está disponible, sino usar estado local
  const sortColumn = externalSortColumn !== undefined ? externalSortColumn : null;
  const sortDirection = externalSortDirection !== undefined ? externalSortDirection : null;

  const previewFieldKeys = cardPreviewFields[listId] || columnSchema.slice(0, 4).map((c) => c.key);

  // Resetear la paginación local cuando cambian los productos
  useEffect(() => {
    setDisplayCount(10);
  }, [products.length]);

  const toggleCard = (productId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedCards(newExpanded);
  };

  const getFieldValue = (product: any, key: string) => {
    const effectiveMappingConfig = product.mappingConfig || mappingConfig;

    // 1) Columna de precio principal configurada
    if (effectiveMappingConfig?.price_primary_key && key === effectiveMappingConfig.price_primary_key) {
      return product.price;
    }

    // 2) Override específico para esta columna
    if (product.calculated_data && key in product.calculated_data) {
      return product.calculated_data[key];
    }

    // 3) Campos normalizados
    if (key === "code") return product.code;
    if (key === "name") return product.name;
    if (key === "price") return product.price;
    if (key === "quantity") return product.quantity;
    if (key === "supplier_name") return product.supplierName;
    if (key === "list_name") return product.listName;

    // 4) Datos originales
    return product.data?.[key];
  };

  const formatValue = (
    value: any,
    type: ColumnSchema["type"],
    key: string,
    product: any,
    mappingConfig?: ProductList["mapping_config"],
  ) => {
    if (value == null) return "-";
    const effectiveMappingConfig = product.mappingConfig || mappingConfig;
    const isPriceColumn =
      key === "price" ||
      key === effectiveMappingConfig?.price_primary_key ||
      (effectiveMappingConfig?.price_alt_keys && effectiveMappingConfig.price_alt_keys.includes(key));

    const isNumericField = type === "number" || isPriceColumn;

    // (La lógica de “modificación aplicada” queda por si la usás más adelante)
    const hasGeneralModifier = isPriceColumn && effectiveMappingConfig?.price_primary_key === key;
    const hasOverride = product.calculated_data && key in product.calculated_data;
    const hasModification = hasGeneralModifier || hasOverride;
    void hasModification;

    if (isNumericField) {
      const parsed = normalizeRawPrice(value);
      return parsed != null ? <span className="flex items-center gap-1.5">{formatARS(parsed)}</span> : "-";
    }
    if (type === "date" && value instanceof Date) {
      return value.toLocaleDateString("es-AR");
    }
    return String(value);
  };

  // Función para alternar el orden de una columna
  const toggleSort = (columnKey: string) => {
    if (!onSortChange) return;

    if (sortColumn === columnKey) {
      // Ciclar: asc -> desc -> null
      if (sortDirection === 'asc') {
        onSortChange(columnKey, 'desc');
      } else if (sortDirection === 'desc') {
        onSortChange(null, null);
      }
    } else {
      onSortChange(columnKey, 'asc');
    }
  };

  // Aplicar ordenamiento a los productos
  const sortedProducts = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return products;
    }

    // Determinar si la columna es de precio para aplicar ordenamiento numérico
    const columnConfig = columnSchema.find(col => col.key === sortColumn);
    const isPriceColumn = sortColumn === "price" || 
                          sortColumn === mappingConfig?.price_primary_key ||
                          (mappingConfig?.price_alt_keys && mappingConfig.price_alt_keys.includes(sortColumn)) ||
                          sortColumn.toLowerCase().includes('precio') ||
                          sortColumn.toLowerCase().includes('price');
    const isNumericColumn = columnConfig?.type === 'number' || isPriceColumn;

    const sorted = [...products].sort((a, b) => {
      const aValue = getFieldValue(a, sortColumn);
      const bValue = getFieldValue(b, sortColumn);

      // Manejar valores nulos
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Solo intentar comparar como números si es una columna numérica
      if (isNumericColumn) {
        const aNum = normalizeRawPrice(aValue);
        const bNum = normalizeRawPrice(bValue);

        if (aNum !== null && bNum !== null) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
      }

      // Comparar como strings (orden alfanumérico natural)
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [products, sortColumn, sortDirection, columnSchema, mappingConfig]);

  // Campos que se muestran arriba (según configuración del usuario)
  const keyFields = previewFieldKeys
    .map((key) => columnSchema.find((col) => col.key === key))
    .filter((col): col is ColumnSchema => col !== undefined);

  const otherFields = columnSchema.filter((col) => !previewFieldKeys.includes(col.key));

  // Paginación local de tarjetas - usar productos ordenados
  const visibleProducts = sortedProducts.slice(0, displayCount);
  const hasLocalMore = displayCount < sortedProducts.length;

  const handleLoadMore = () => {
    if (hasLocalMore) {
      setDisplayCount((prev) => prev + 10);
    } else if (onLoadMore && hasMore) {
      onLoadMore();
    }
  };

  return (
    <>
      {/* Controles de ordenamiento */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Ordenar por:</span>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={`min-w-[180px] justify-between ${!sortColumn ? 'rounded-md' : 'rounded-r-none'}`}>
                {sortColumn 
                  ? columnSchema.find(c => c.key === sortColumn)?.label || 'Seleccionar...'
                  : 'Seleccionar...'
                }
                {!sortColumn && <ArrowUpDown className="h-4 w-4 ml-2" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {columnSchema.map((field) => {
                const isActive = sortColumn === field.key;
                return (
                  <DropdownMenuItem
                    key={field.key}
                    onClick={() => toggleSort(field.key)}
                    className="flex items-center justify-between"
                  >
                    <span>{field.label}</span>
                    {isActive && sortDirection === 'asc' && <ArrowUp className="h-3 w-3" />}
                    {isActive && sortDirection === 'desc' && <ArrowDown className="h-3 w-3" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          {sortColumn && (
            <Button
              variant="outline"
              size="sm"
              className="px-2 rounded-l-none border-l-0"
              onClick={(e) => {
                e.stopPropagation();
                if (!onSortChange) return;
                if (sortDirection === 'asc') {
                  onSortChange(sortColumn, 'desc');
                } else {
                  onSortChange(sortColumn, 'asc');
                }
              }}
            >
              {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
        {sortColumn && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (onSortChange) {
                onSortChange(null, null);
              }
            }}
            className="text-xs"
          >
            Restablecer
          </Button>
        )}
      </div>

      {/* Contenedor con scroll para las cards */}
      <div className="max-h-[600px] overflow-auto border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleProducts.map((product) => {
          const isExpanded = expandedCards.has(product.id);
          const quantity = product.quantity || 0;
          const effectiveMappingConfig = product.mappingConfig || mappingConfig;
          const lowStockThreshold = effectiveMappingConfig?.low_stock_threshold || 50;
          const isLowStock = quantity < lowStockThreshold;

          return (
            <Card key={product.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="space-y-2">
                  {keyFields.map((field) => {
                    const value = getFieldValue(product, field.key);
                    const displayValue = formatValue(value, field.type, field.key, product, mappingConfig);

                    // Campo especial para Stock con QuantityCell, igual que en /stock
                    if (field.key === "quantity") {
                      const quantityField = field;
                      const q = product.quantity || 0;
                      const effectiveMappingConfig = product.mappingConfig || mappingConfig;
                      const lowStockThresholdField = effectiveMappingConfig?.low_stock_threshold || 0;
                      const isLowStockField = q < lowStockThresholdField;

                      return (
                        <div key={field.key} className="text-sm border-b pb-1 flex flex-col gap-2">
                          {isLowStockField && (
                            <div className="w-22 from-1440:w-4/12">
                              <Badge variant="destructive" className="text-xs">
                                Bajo Stock
                              </Badge>
                            </div>
                          )}
                          <div className="flex items-center justify-between w-full from-1440:justify-normal from-1440:gap-2">
                            <span className="text-muted-foreground">{quantityField.label}:</span>{" "}
                            <QuantityCell
                              productId={product.id}
                              listId={product.listId ?? listId}
                              value={product.quantity}
                              onLocalUpdate={(newQty) => {
                                product.quantity = newQty;
                              }}
                              visibleSpan={true}
                            />
                          </div>
                        </div>
                      );
                    }

                    // Resto de campos: mismo diseño genérico que en /stock
                    return (
                      <div key={field.key} className="text-sm border-b pb-1 flex gap-1">
                        <span className="text-muted-foreground">{field.label}:</span>{" "}
                        <span className="font-medium">{displayValue}</span>
                      </div>
                    );
                  })}
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex-1 flex flex-col">
                {otherFields.length > 0 && (
                  <Collapsible open={isExpanded} onOpenChange={() => toggleCard(product.id)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full mb-2">
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Ocultar detalles
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            Ver más campos ({otherFields.length})
                          </>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mb-3">
                      {otherFields.map((field) => {
                        const value = getFieldValue(product, field.key);
                        const displayValue = formatValue(value, field.type, field.key, product, mappingConfig);

                        return (
                          <div key={field.key} className="text-sm border-b pb-1">
                            <span className="text-muted-foreground">{field.label}:</span>{" "}
                            <span className="font-medium">{displayValue}</span>
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {showActions && onAddToRequest && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAddToRequest(product, mappingConfig)}
                    className="mt-auto"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Agregar al pedido
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

        {(hasLocalMore || hasMore) && (
          <div className="text-center mt-6">
            <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cargando más...
                </>
              ) : (
                <>
                  Ver más productos
                  {hasLocalMore && ` (${sortedProducts.length - displayCount} más disponibles)`}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
