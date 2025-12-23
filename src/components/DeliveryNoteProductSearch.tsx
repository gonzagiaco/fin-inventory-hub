import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Loader2 } from "lucide-react";
import { formatARS } from "@/utils/numberParser";
import { useGlobalProductSearch } from "@/hooks/useGlobalProductSearch";
import { useProductLists } from "@/hooks/useProductLists";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { MappingConfig } from "@/components/suppliers/ListConfigurationView";
import { localDB } from "@/lib/localDB";
import { supabase } from "@/integrations/supabase/client";

interface ProductSearchProps {
  onSelect: (product: { id?: string; code: string; name: string; price: number }) => void;
}

const DeliveryNoteProductSearch = ({ onSelect }: ProductSearchProps) => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const { productLists } = useProductLists();
  const isOnline = useOnlineStatus();

  const {
    data: searchData, 
    isLoading,
    isOnline: isSearchOnline
  } = useGlobalProductSearch({
    searchTerm: query,
    supplierFilter: "all",
    minSearchLength: 2,
    pageSize: 20,
  });

  const results = useMemo(() => {
    if (!searchData?.pages) return [];
    return searchData.pages.flatMap((page) => page.data || []);
  }, [searchData]);

  const parsePriceValue = (rawValue: unknown): number | null => {
    if (rawValue == null) return null;
    if (typeof rawValue === "number") return rawValue;
    const parsed = parseFloat(String(rawValue).replace(/[^0-9.,-]/g, "").replace(",", "."));
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleSelect = async (product: any) => {
    // Obtener nombre del producto
    let productName = product.name || product.code || "Producto sin nombre";
    let productPrice = product.price || 0;

    // Obtener configuración de la lista
    const list = productLists.find((l: any) => l.id === product.list_id);
    const mappingConfig = list?.mapping_config as MappingConfig | undefined;
    
    console.log('📦 DeliveryNote - Producto seleccionado:', {
      product_id: product.product_id,
      list_id: product.list_id,
      price_from_search: product.price,
      calculated_data: product.calculated_data,
      delivery_note_price_column: mappingConfig?.delivery_note_price_column
    });

    // Si tenemos el producto completo con data, extraer mejor nombre
    if (product.dynamic_products?.data) {
      if (mappingConfig?.name_keys && Array.isArray(mappingConfig.name_keys)) {
        for (const key of mappingConfig.name_keys) {
          const value = product.dynamic_products.data[key];
          if (value && String(value).trim()) {
            productName = String(value).trim();
            break;
          }
        }
      }
    }

    // Usar columna de precio configurada para remitos
    if (mappingConfig?.delivery_note_price_column) {
      const priceCol = mappingConfig.delivery_note_price_column;
      let resolvedPrice: number | null = null;

      console.log('🔍 DeliveryNote - Buscando precio en columna:', priceCol);

      // 1. Buscar en calculated_data del resultado RPC (columnas personalizadas/calculadas)
      if (product.calculated_data && typeof product.calculated_data === 'object' && Object.keys(product.calculated_data).length > 0) {
        console.log('🔍 DeliveryNote - calculated_data del RPC:', product.calculated_data);
        if (product.calculated_data[priceCol] != null) {
          resolvedPrice = parsePriceValue(product.calculated_data[priceCol]);
          console.log('✅ DeliveryNote - Precio encontrado en RPC calculated_data:', resolvedPrice);
        }
      }

      // 2. Si calculated_data del RPC está vacío o no tiene la columna, buscar en IndexedDB
      if (resolvedPrice == null && product.product_id) {
        const indexRecord = await localDB.dynamic_products_index
          .where('product_id')
          .equals(product.product_id)
          .first();
        
        console.log('🔍 DeliveryNote - IndexedDB record:', indexRecord?.calculated_data);
        
        if (indexRecord?.calculated_data?.[priceCol] != null) {
          resolvedPrice = parsePriceValue(indexRecord.calculated_data[priceCol]);
          console.log('✅ DeliveryNote - Precio encontrado en IndexedDB:', resolvedPrice);
        }
      }

      // 3. Buscar en data del producto completo (columnas originales del archivo)
      if (resolvedPrice == null) {
        if (product.dynamic_products?.data?.[priceCol] != null) {
          resolvedPrice = parsePriceValue(product.dynamic_products.data[priceCol]);
          console.log('✅ DeliveryNote - Precio encontrado en dynamic_products.data:', resolvedPrice);
        } else if (product.data?.[priceCol] != null) {
          resolvedPrice = parsePriceValue(product.data[priceCol]);
          console.log('✅ DeliveryNote - Precio encontrado en product.data:', resolvedPrice);
        }
      }

      // 4. Fallback final: buscar en dynamic_products local
      if (resolvedPrice == null && product.product_id) {
        const localProduct = await localDB.dynamic_products.get(product.product_id);
        resolvedPrice = parsePriceValue(localProduct?.data?.[priceCol]);

        if (resolvedPrice != null) {
          console.log('✅ DeliveryNote - Precio encontrado en local dynamic_products:', resolvedPrice);
        }

        // 5. Si aún no hay precio y estamos online, consultar Supabase directamente
        if (resolvedPrice == null && isOnline) {
          const { data: remoteProduct, error } = await supabase
            .from("dynamic_products")
            .select("data")
            .eq("id", product.product_id)
            .maybeSingle();

          if (!error && remoteProduct?.data?.[priceCol] != null) {
            resolvedPrice = parsePriceValue(remoteProduct.data[priceCol]);
            console.log('✅ DeliveryNote - Precio encontrado en Supabase:', resolvedPrice);
          }
        }
      }

      if (resolvedPrice != null) {
        productPrice = resolvedPrice;
        console.log('💰 DeliveryNote - Precio final resuelto:', productPrice);
      } else {
        console.log('⚠️ DeliveryNote - No se encontró precio en columna', priceCol, ', usando precio por defecto:', productPrice);
      }
    }

    onSelect({
      id: product.product_id,
      code: product.code || "SIN-CODIGO",
      name: productName,
      price: productPrice,
    });

    setQuery("");
    setIsFocused(false);
  };

  const showResults = isFocused && query.length >= 2;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Delay para permitir click en resultados
              setTimeout(() => setIsFocused(false), 200);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading && showResults && (
        <Card className="absolute z-50 mt-1 w-full p-4 text-center">
          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">
            Buscando{!isSearchOnline ? " (modo offline)" : ""}...
          </p>
        </Card>
      )}

      {!isLoading && showResults && results.length > 0 && (
        <Card className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto shadow-lg">
          <div className="divide-y">
            {results.map((product: any) => (
              <div
                key={product.product_id}
                className="p-3 hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleSelect(product)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">{product.name || product.code || "Sin nombre"}</p>
                    <p className="text-sm text-muted-foreground">
                      Código: {product.code || "N/A"}
                    </p>
                    {product.quantity !== undefined && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">Stock:</span>
                        <span 
                          className={`text-xs font-semibold ${
                            product.quantity === 0 
                              ? "text-red-500" 
                              : product.quantity < 10 
                              ? "text-orange-500" 
                              : "text-green-600"
                          }`}
                        >
                          {product.quantity} unidades
                        </span>
                        {product.quantity === 0 && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                            Sin stock
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatARS(product.price || 0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!isLoading && showResults && query.length >= 2 && results.length === 0 && (
        <Card className="absolute z-50 mt-1 w-full p-4 text-center">
          <p className="text-muted-foreground">
            No se encontraron productos{!isSearchOnline ? " (modo offline)" : ""}
          </p>
        </Card>
      )}
    </div>
  );
};

export default DeliveryNoteProductSearch;
