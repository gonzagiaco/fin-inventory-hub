import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProductListDetails, EnrichedProduct } from "@/hooks/useAllDynamicProducts";
import { ProductListStockTable } from "./ProductListStockTable";

interface SupplierStockSectionProps {
  supplierName: string;
  supplierLogo: string | null;
  lists: ProductListDetails[];
  productsByList: Map<string, EnrichedProduct[]>;
  onAddToRequest: (product: EnrichedProduct) => void;
}

export function SupplierStockSection({
  supplierName,
  supplierLogo,
  lists,
  productsByList,
  onAddToRequest,
}: SupplierStockSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const totalProducts = lists.reduce((sum, list) => {
    const products = productsByList.get(list.listId) || [];
    return sum + products.length;
  }, 0);

  return (
    <Card className="mb-6 w-full">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {supplierLogo && (
              <img
                src={supplierLogo}
                alt={supplierName}
                className="h-10 w-10 object-contain rounded"
              />
            )}
            <div>
              <h2 className="text-xl font-semibold">{supplierName}</h2>
              <p className="text-sm text-muted-foreground">
                {lists.length} {lists.length === 1 ? "lista" : "listas"} • {totalProducts} productos
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            {isExpanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {lists.map((list) => {
            const products = productsByList.get(list.listId) || [];
            return (
              <ProductListStockTable
                key={list.listId}
                list={list}
                products={products}
                onAddToRequest={onAddToRequest}
              />
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
