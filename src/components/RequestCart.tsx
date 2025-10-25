import { X, Minus, Plus, Download, ShoppingCart } from "lucide-react";
import { RequestItem, Supplier } from "@/types";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface RequestCartProps {
  requests: RequestItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onExport: () => void;
  suppliers: Supplier[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const RequestCart = ({
  requests,
  onUpdateQuantity,
  onRemove,
  onExport,
  suppliers,
  isCollapsed,
  onToggleCollapse,
}: RequestCartProps) => {
  const total = requests.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);

  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name || "Unknown";
  };

  // Collapsed view - floating button
  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="fixed bottom-6 md:top-6 right-6 z-50 bg-primary hover:bg-primary/90 rounded-full p-4 shadow-2xl transition-transform hover:scale-110"
      >
        <ShoppingCart className="h-6 w-6 text-primary-foreground" />
        {requests.length > 0 && (
          <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground">
            {requests.length}
          </Badge>
        )}
      </button>
    );
  }

  // Expanded view - floating panel
  return (
    <div className="fixed bottom-6 md:top-6 right-6 z-50 w-96 max-h-[600px] glassmorphism rounded-xl shadow-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
        <h2 className="text-xl font-bold text-foreground">Lista de Pedidos</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-3 rounded-lg shadow-lg transition-transform hover:scale-105 flex items-center text-sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </button>
          <button onClick={onToggleCollapse} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">No hay productos en la lista</div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {requests.map((item) => (
              <div key={item.id} className="bg-muted/30 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Código: {item.code} | Proveedor: {getSupplierName(item.supplierId)}
                  </div>
                  <div className="text-sm font-medium text-foreground mt-1">
                    Subtotal: ${(item.costPrice * item.quantity).toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 bg-background/50 rounded-lg px-2">
                    <button
                      onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      className="p-1 hover:bg-primary/20 rounded transition-colors"
                    >
                      <Minus className="h-4 w-4 text-primary" />
                    </button>
                    <span className="font-semibold text-foreground min-w-[2rem] text-center">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="p-1 hover:bg-primary/20 rounded transition-colors"
                    >
                      <Plus className="h-4 w-4 text-primary" />
                    </button>
                  </div>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="p-2 hover:bg-red-500/20 rounded-full transition-colors text-red-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-4 bg-muted/30">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-foreground">Total:</span>
              <span className="text-2xl font-bold text-primary">${total.toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RequestCart;
