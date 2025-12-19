import { Plus, ShoppingCart, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToMyStock, removeFromMyStock } from "@/hooks/useMyStockProducts";
import { useQueryClient } from "@tanstack/react-query";

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

  // If product already has stock, don't show "Add to My Stock" option
  const hasStock = (product.quantity || 0) > 0;
  const shouldShowAddToStock = showAddToStock && !hasStock;

  // If we're in MyStock page and showing remove option
  if (showRemoveFromStock) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-background">
          <DropdownMenuItem onClick={() => onAddToRequest(product, mappingConfig)}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Agregar al pedido
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleRemoveFromStock} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Quitar de Mi Stock
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // If we don't need to show dropdown, just show simple button
  if (!shouldShowAddToStock) {
    return (
      <Button size="sm" variant="outline" onClick={() => onAddToRequest(product, mappingConfig)}>
        <Plus className="h-4 w-4 mr-1" />
        Agregar
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-background">
        <DropdownMenuItem onClick={() => onAddToRequest(product, mappingConfig)}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Agregar al pedido
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleAddToStock}>
          <Package className="h-4 w-4 mr-2" />
          Agregar a Mi Stock
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
