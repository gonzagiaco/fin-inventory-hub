import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DynamicProduct, ColumnSchema } from "@/types/productList";
import { Loader2 } from "lucide-react";
import { useProductListStore } from "@/stores/productListStore";

interface ProductCardViewProps {
  listId: string;
  products: DynamicProduct[] | any[];
  columnSchema: ColumnSchema[];
  onAddToRequest?: (product: any) => void;
  showActions?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function ProductCardView({
  listId,
  products,
  columnSchema,
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

  // Reset display count when products change
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
    if (key === "code") return product.code;
    if (key === "name") return product.name;
    if (key === "price") return product.price;
    if (key === "quantity") return product.quantity;
    // Check calculated_data first for overridden prices
    if (product.calculated_data && key in product.calculated_data) {
      return product.calculated_data[key];
    }
    return product.data?.[key];
  };

  const formatValue = (value: any, type: ColumnSchema["type"], key: string) => {
    if (value == null) return "-";
    const isNumericField = type === "number" || key === "price";
    if (isNumericField && typeof value === "number") {
      return value.toFixed(2);
    }
    if (type === "date" && value instanceof Date) {
      return value.toLocaleDateString("es-AR");
    }
    return String(value);
  };

  // Separate key fields based on user configuration and other fields
  // Sort keyFields based on the order in previewFieldKeys
  const keyFields = previewFieldKeys
    .map((key) => columnSchema.find((col) => col.key === key))
    .filter((col): col is ColumnSchema => col !== undefined);

  const otherFields = columnSchema.filter((col) => !previewFieldKeys.includes(col.key));

  // Slice products for local pagination
  const visibleProducts = products.slice(0, displayCount);
  const hasLocalMore = displayCount < products.length;

  const handleLoadMore = () => {
    if (hasLocalMore) {
      // Load 10 more locally
      setDisplayCount(prev => prev + 10);
    } else if (onLoadMore && hasMore) {
      // Load from server if no more local products
      onLoadMore();
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleProducts.map((product) => {
          const isExpanded = expandedCards.has(product.id);
          const quantity = product.quantity || 0;
          const isLowStock = quantity < 50;

          return (
            <Card key={product.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="space-y-2">
                  {keyFields.map((field) => {
                    const value = getFieldValue(product, field.key);
                    const displayValue = formatValue(value, field.type, field.key);

                    // Special styling for common fields
                    if (field.key === "code") {
                      return (
                        <div key={field.key} className="font-mono text-sm text-muted-foreground">
                          {displayValue}
                        </div>
                      );
                    }
                    if (field.key === "name") {
                      return (
                        <h4 key={field.key} className="font-semibold text-base leading-tight">
                          {displayValue}
                        </h4>
                      );
                    }
                    if (field.key === "price") {
                      return (
                        <Badge key={field.key} variant="secondary" className="w-fit">
                          ${displayValue}
                        </Badge>
                      );
                    }
                    if (field.key === "quantity") {
                      return (
                        <div key={field.key} className="flex items-center gap-2">
                          {isLowStock && (
                            <Badge variant="destructive" className="text-xs">
                              Bajo Stock
                            </Badge>
                          )}
                          <span className="text-sm">Stock: {displayValue}</span>
                        </div>
                      );
                    }

                    // Default display for other configured fields
                    return (
                      <div key={field.key} className="text-sm border-b pb-1">
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
                        const displayValue = formatValue(value, field.type, field.key);

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
                  <Button size="sm" variant="outline" onClick={() => onAddToRequest(product)} className="mt-auto">
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
