import { useState, useEffect } from "react";
import { StockItem, InvoiceProduct } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";

interface ProductSelectorProps {
  stockItems: StockItem[];
  selectedProducts: InvoiceProduct[];
  onChange: (products: InvoiceProduct[]) => void;
}

const ProductSelector = ({ stockItems, selectedProducts, onChange }: ProductSelectorProps) => {
  const [currentProductId, setCurrentProductId] = useState<string>("");
  const [currentQuantity, setCurrentQuantity] = useState<string>("1");

  const addProduct = () => {
    if (!currentProductId) return;

    const stockItem = stockItems.find((item) => item.id === currentProductId);
    if (!stockItem) return;

    const quantity = parseInt(currentQuantity) || 1;
    
    // Calculate sale price: cost × 2, or (cost × 0.92) × 2 if special discount
    const salePrice = stockItem.specialDiscount
      ? stockItem.costPrice * 0.92 * 2
      : stockItem.costPrice * 2;
    
    const subtotal = salePrice * quantity;

    const newProduct: InvoiceProduct = {
      code: stockItem.code,
      name: stockItem.name,
      costPrice: stockItem.costPrice,
      salePrice,
      quantity,
      subtotal,
    };

    onChange([...selectedProducts, newProduct]);
    setCurrentProductId("");
    setCurrentQuantity("1");
  };

  const removeProduct = (index: number) => {
    const updated = selectedProducts.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateQuantity = (index: number, quantity: number) => {
    const updated = [...selectedProducts];
    updated[index].quantity = quantity;
    updated[index].subtotal = updated[index].salePrice * quantity;
    onChange(updated);
  };

  const calculateTotal = () => {
    return selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr,120px,auto] gap-2 items-end">
        <div className="grid gap-2">
          <Label htmlFor="product" className="text-foreground">
            Producto
          </Label>
          <Select value={currentProductId} onValueChange={setCurrentProductId}>
            <SelectTrigger className="bg-muted/50 border-primary/20 text-foreground">
              <SelectValue placeholder="Seleccionar producto" />
            </SelectTrigger>
            <SelectContent className="bg-card border-primary/20 z-[100]">
              {stockItems.map((item) => (
                <SelectItem
                  key={item.id}
                  value={item.id}
                  className="text-foreground hover:bg-primary/10"
                >
                  {item.code} - {item.name} (${item.costPrice.toFixed(2)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="quantity" className="text-foreground">
            Cantidad
          </Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            value={currentQuantity}
            onChange={(e) => setCurrentQuantity(e.target.value)}
            className="bg-muted/50 border-primary/20 text-foreground"
          />
        </div>
        <Button
          type="button"
          onClick={addProduct}
          size="icon"
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {selectedProducts.length > 0 && (
        <div className="border border-primary/20 rounded-lg p-4 space-y-2">
          <div className="text-sm font-medium text-foreground mb-2">Productos Seleccionados</div>
          {selectedProducts.map((product, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">
                  {product.code} - {product.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  ${product.salePrice.toFixed(2)} × {product.quantity} = $
                  {product.subtotal.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={product.quantity}
                  onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                  className="w-20 bg-muted/50 border-primary/20 text-foreground text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeProduct(index)}
                  className="text-red-500 hover:bg-red-500/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-primary/20">
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-foreground">Total:</span>
              <span className="text-primary">${calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSelector;
