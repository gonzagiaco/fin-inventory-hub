import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DynamicProduct, ColumnSchema, ProductList } from "@/types/productList";
import { Loader2 } from "lucide-react";
import { useProductListStore } from "@/stores/productListStore";
import { QuantityCell } from "./stock/QuantityCell";

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
}

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
}: ProductCardViewProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(10);
  const { cardPreviewFields } = useProductListStore();

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

    if (isNumericField && typeof value === "number") {
      return <span className="flex items-center gap-1.5">${value.toFixed(2)}</span>;
    }
    if (type === "date" && value instanceof Date) {
      return value.toLocaleDateString("es-AR");
    }
    return String(value);
  };

  // Campos que se muestran arriba (según configuración del usuario)
  const keyFields = previewFieldKeys
    .map((key) => columnSchema.find((col) => col.key === key))
    .filter((col): col is ColumnSchema => col !== undefined);

  const otherFields = columnSchema.filter((col) => !previewFieldKeys.includes(col.key));

  // Paginación local de tarjetas
  const visibleProducts = products.slice(0, displayCount);
  const hasLocalMore = displayCount < products.length;

  const handleLoadMore = () => {
    if (hasLocalMore) {
      setDisplayCount((prev) => prev + 10);
    } else if (onLoadMore && hasMore) {
      onLoadMore();
    }
  };

  return (
    <>
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
                      return (
                        <div key={field.key} className="text-sm border-b pb-1 flex items-center gap-2">
                          {isLowStock && (
                            <Badge variant="destructive" className="text-xs">
                              Bajo Stock
                            </Badge>
                          )}
                          <span className="text-muted-foreground">{field.label}:</span>{" "}
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
                {hasLocalMore && ` (${products.length - displayCount} más disponibles)`}
              </>
            )}
          </Button>
        </div>
      )}
    </>
  );
}
