import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useSearch } from "@/hooks/useSearch";
import { Search, Loader2 } from "lucide-react";

interface ProductSearchProps {
  onSelect: (product: { id?: string; code: string; name: string; price: number }) => void;
}

const DeliveryNoteProductSearch = ({ onSelect }: ProductSearchProps) => {
  const [query, setQuery] = useState("");
  
  const { results, loading } = useSearch(query, 10);

  const handleSelect = (product: any) => {
    onSelect({
      id: product.product_id,
      code: product.code || "",
      name: product.name || "",
      price: product.price || 0,
    });
    setQuery("");
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading && (
        <Card className="absolute z-50 mt-1 w-full p-4 text-center">
          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
        </Card>
      )}

      {!loading && results.length > 0 && (
        <Card className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto">
          <div className="divide-y">
            {results.map((product) => (
              <div
                key={product.product_id}
                className="p-3 hover:bg-accent cursor-pointer"
                onClick={() => handleSelect(product)}
              >
                <p className="font-medium">{product.name || product.code}</p>
                <p className="text-sm text-muted-foreground">
                  Código: {product.code || 'N/A'} | ${(product.price || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <Card className="absolute z-50 mt-1 w-full p-4 text-center">
          <p className="text-muted-foreground">No se encontraron productos</p>
        </Card>
      )}
    </div>
  );
};

export default DeliveryNoteProductSearch;
