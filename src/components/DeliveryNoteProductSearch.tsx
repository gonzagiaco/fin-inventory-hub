import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAllDynamicProducts } from "@/hooks/useAllDynamicProducts";
import { useStock } from "@/hooks/useStock";
import { Search, Plus } from "lucide-react";

interface ProductSearchProps {
  onSelect: (product: { id?: string; code: string; name: string; price: number }) => void;
}

const DeliveryNoteProductSearch = ({ onSelect }: ProductSearchProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  
  const { allProducts: dynamicProducts } = useAllDynamicProducts();
  const { stockItems } = useStock();

  const allProducts = [
    ...dynamicProducts.map(p => ({
      id: p.id,
      code: p.code || "",
      name: p.name || "",
      price: p.price || 0,
      source: 'dynamic' as const,
    })),
    ...stockItems.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      price: s.costPrice,
      source: 'stock' as const,
    })),
  ];

  const filteredProducts = query.length > 0
    ? allProducts.filter(p => {
        const searchTerm = query.toLowerCase();
        return (
          p.code.toLowerCase().includes(searchTerm) ||
          p.name.toLowerCase().includes(searchTerm)
        );
      }).slice(0, 10)
    : [];

  const handleSelect = (product: typeof allProducts[0]) => {
    onSelect({
      id: product.id,
      code: product.code,
      name: product.name,
      price: product.price,
    });
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-9"
          />
        </div>
      </div>

      {isOpen && filteredProducts.length > 0 && (
        <Card className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto">
          <div className="divide-y">
            {filteredProducts.map((product) => (
              <div
                key={`${product.source}-${product.id}`}
                className="p-3 hover:bg-accent cursor-pointer flex justify-between items-center"
                onClick={() => handleSelect(product)}
              >
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Código: {product.code} | ${product.price.toFixed(2)}
                  </p>
                </div>
                <Button size="sm" variant="ghost">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isOpen && query.length > 0 && filteredProducts.length === 0 && (
        <Card className="absolute z-50 mt-1 w-full p-4 text-center text-muted-foreground">
          No se encontraron productos
        </Card>
      )}
    </div>
  );
};

export default DeliveryNoteProductSearch;
