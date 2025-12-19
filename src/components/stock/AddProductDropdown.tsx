import { Plus, ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToMyStock } from "@/hooks/useMyStockProducts";
import { useQueryClient } from "@tanstack/react-query";

interface AddProductDropdownProps {
  product: any;
  mappingConfig?: any;
  onAddToRequest: (product: any, mappingConfig?: any) => void;
  showAddToStock?: boolean;
}

export function AddProductDropdown({
  product,
  mappingConfig,
  onAddToRequest,
  showAddToStock = true,
}: AddProductDropdownProps) {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const handleAddToStock = async () => {
    try {
      await addToMyStock(product.id, product.listId, isOnline);
      queryClient.invalidateQueries({ queryKey: ["my-stock"] });
      toast.success("Producto agregado a Mi Stock");
    } catch (error: any) {
      console.error("Error adding to stock:", error);
      toast.error("Error al agregar a Mi Stock");
    }
  };

  // If product already has stock, don't show "Add to My Stock" option
  const hasStock = (product.quantity || 0) > 0;
  const shouldShowAddToStock = showAddToStock && !hasStock;

  // If we don't need to show dropdown, just show simple button
  if (!shouldShowAddToStock) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => onAddToRequest(product, mappingConfig)}
      >
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
