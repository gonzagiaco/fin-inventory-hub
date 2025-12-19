import { ShoppingCart, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToMyStock, removeFromMyStock } from "@/hooks/useMyStockProducts";
import { useQueryClient } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AddProductDropdownProps {
  product: any;
  mappingConfig?: any;
  onAddToRequest: (product: any, mappingConfig?: any) => void;
  showAddToStock?: boolean;
  showRemoveFromStock?: boolean;
}

export function AddProductDropdown({
  product,
  mappingConfig,
  onAddToRequest,
  showAddToStock = true,
  showRemoveFromStock = false,
}: AddProductDropdownProps) {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const productId = product.product_id || product.id;
  const listId = product.list_id || product.listId;

  const handleAddToStock = async () => {
    toast.success("Agregado a Mi Stock");
    queryClient.invalidateQueries({ queryKey: ["my-stock"] });

    queueMicrotask(async () => {
      try {
        await addToMyStock(productId, listId, isOnline);
      } catch (error) {
        console.error("Error al agregar a Mi Stock:", error);
      }
    });
  };

  const handleRemoveFromStock = async () => {
    toast.success("Producto quitado de Mi Stock");

    try {
      await removeFromMyStock(productId, listId, isOnline);
      queryClient.invalidateQueries({ queryKey: ["my-stock"] });
    } catch (error: any) {
      console.error("Error removing from stock:", error);
      toast.error("Error al quitar de Mi Stock");
    }
  };

  // If product is already in My Stock, don't show "Add to My Stock" option
  const isInMyStock = product.in_my_stock === true;
  const shouldShowAddToStock = showAddToStock && !isInMyStock;

  // Página Mi Stock: mostrar botones para agregar al pedido y quitar del stock
  if (showRemoveFromStock) {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onAddToRequest(product, mappingConfig)}
                className="flex-1"
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="sr-only">Agregar al pedido</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Agregar al pedido</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRemoveFromStock}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Quitar de Mi Stock</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Quitar de Mi Stock</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  // Producto ya en Mi Stock: solo mostrar botón de agregar al pedido
  if (!shouldShowAddToStock) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onAddToRequest(product, mappingConfig)} 
              className="w-full"
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Pedido
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Agregar al pedido</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Lista de productos: mostrar dos botones separados
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onAddToRequest(product, mappingConfig)}
              className="flex-1"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="sr-only">Agregar al pedido</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Agregar al pedido</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleAddToStock}
              className="text-primary hover:text-primary"
            >
              <Package className="h-4 w-4" />
              <span className="sr-only">Agregar a Mi Stock</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Agregar a Mi Stock</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
