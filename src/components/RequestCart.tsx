import { X, Minus, Plus, Download } from "lucide-react";
import { RequestItem } from "@/types";
import { toast } from "sonner";

interface RequestCartProps {
  requests: RequestItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onExport: () => void;
}

const RequestCart = ({ requests, onUpdateQuantity, onRemove, onExport }: RequestCartProps) => {
  const total = requests.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);

  if (requests.length === 0) {
    return (
      <div className="glassmorphism rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-foreground">Lista de Pedidos</h2>
        <p className="text-muted-foreground text-center py-8">
          No hay productos en la lista de pedidos
        </p>
      </div>
    );
  }

  return (
    <div className="glassmorphism rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Lista de Pedidos</h2>
        <button
          onClick={onExport}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex items-center"
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar Excel
        </button>
      </div>
      
      <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
        {requests.map((item) => (
          <div
            key={item.id}
            className="bg-muted/30 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex-1">
              <div className="font-semibold text-foreground">{item.name}</div>
              <div className="text-sm text-muted-foreground">
                Código: {item.code} | Proveedor: {item.supplier}
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
                <span className="font-semibold text-foreground min-w-[2rem] text-center">
                  {item.quantity}
                </span>
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
      
      <div className="border-t border-white/10 pt-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-foreground">Total:</span>
          <span className="text-2xl font-bold text-primary">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default RequestCart;