import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DynamicProductTable } from "@/components/DynamicProductTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ColumnMappingWizard } from "@/components/mapping/ColumnMappingWizard";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useListProducts } from "@/hooks/useListProducts";
import { DynamicProduct } from "@/types/productList";

interface SupplierStockSectionProps {
  supplierName: string;
  supplierLogo: string | null;
  lists: Array<{
    id: string;
    name: string;
    supplierId: string;
    mappingConfig: any;
    productCount: number;
    columnSchema: any[];
  }>;
  onAddToRequest: (product: any) => void;
}

export function SupplierStockSection({ supplierName, supplierLogo, lists, onAddToRequest }: SupplierStockSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [listToMap, setListToMap] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const totalProducts = lists.reduce((sum, list) => sum + list.productCount, 0);

  return (
    <Card className="mb-6 w-full max-w-full overflow-hidden">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {supplierLogo && <img src={supplierLogo} alt={supplierName} className="h-10 w-10 object-contain rounded" />}
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
        <CardContent className="space-y-6 w-full overflow-hidden">
          {lists.map((list) => (
            <Collapsible key={list.id}>
              <div className="border rounded-lg">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <ChevronDown className="h-4 w-4" />
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{list.name}</h4>
                          {!list.mappingConfig && (
                            <Badge variant="destructive" className="text-xs">
                              Sin mapear
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{list.productCount} productos</p>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {list.mappingConfig ? (
                    <ListProductsWrapper
                      listId={list.id}
                      columnSchema={list.columnSchema}
                      onAddToRequest={onAddToRequest}
                    />
                  ) : (
                    <div className="p-6 text-center border-t">
                      <p className="text-muted-foreground mb-4">Esta lista no tiene configuración de mapeo</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button onClick={() => setListToMap(list.id)}>
                            <Settings className="w-4 h-4 mr-2" />
                            Configurar Mapeo
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Configurar Mapeo de Columnas</DialogTitle>
                          </DialogHeader>
                          <ColumnMappingWizard
                            listId={list.id}
                            onSaved={() => {
                              setListToMap(null);
                              queryClient.invalidateQueries({ queryKey: ["product-lists-index"] });
                              toast.success("Mapeo guardado e índice actualizado");
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// Wrapper component to handle data fetching for each list
function ListProductsWrapper({
  listId,
  columnSchema,
  onAddToRequest,
}: {
  listId: string;
  columnSchema: any[];
  onAddToRequest: (product: any) => void;
}) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useListProducts(listId);

  const allProducts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) =>
      (page.data || []).map(
        (item: any) =>
          ({
            id: item.product_id,
            listId: item.list_id,
            code: item.code,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            data: item.dynamic_products ? item.dynamic_products.data : (item.data ?? {}),
          }) as DynamicProduct,
      ),
    );
  }, [data]);

  if (isLoading) {
    return <div className="p-6 text-center">Cargando productos...</div>;
  }

  return (
    <div className="p-4 border-t">
      <DynamicProductTable
        listId={listId}
        products={allProducts}
        columnSchema={columnSchema}
        onAddToRequest={onAddToRequest}
        showStockActions
        onLoadMore={() => {
          void fetchNextPage();
        }}
        hasMore={hasNextPage}
        isLoadingMore={isFetchingNextPage}
      />
    </div>
  );
}
