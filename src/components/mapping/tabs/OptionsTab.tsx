import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MappingConfig } from "@/components/suppliers/ListConfigurationView";

interface OptionsTabProps {
  keys: string[];
  map: MappingConfig;
  setMap: React.Dispatch<React.SetStateAction<MappingConfig>>;
  isNumericColumn: (key: string) => boolean;
}

export function OptionsTab({ keys, map, setMap, isNumericColumn }: OptionsTabProps) {
  return (
    <div className="space-y-6">
      {/* Low Stock Threshold */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <Label htmlFor="low_stock_threshold" className="text-base font-semibold">
            Umbral de Bajo Stock
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Los productos con cantidad menor a este valor se marcarán como "Bajo Stock".
          </p>
        </div>
        <Input
          id="low_stock_threshold"
          type="number"
          min={0}
          value={map.low_stock_threshold?.toString() ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              setMap((prev) => ({ ...prev, low_stock_threshold: undefined }));
              return;
            }
            const parsed = Number(raw);
            if (!Number.isNaN(parsed) && parsed >= 0) {
              setMap((prev) => ({ ...prev, low_stock_threshold: parsed }));
            }
          }}
          className="max-w-[200px]"
          placeholder="0"
        />
      </div>

      {/* Cart Price Column */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <Label className="text-base font-semibold">Columna de Precio para Carrito</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Esta columna se usará cuando agregues productos a la lista de pedidos.
          </p>
        </div>
        <Select
          value={map.cart_price_column || ""}
          onValueChange={(value) => setMap({ ...map, cart_price_column: value || null })}
        >
          <SelectTrigger className="max-w-[300px]">
            <SelectValue placeholder="Selecciona la columna de precio" />
          </SelectTrigger>
          <SelectContent>
            {keys
              .filter((key) => isNumericColumn(key))
              .map((key) => {
                let label = key;
                if (key === map.price_primary_key) {
                  label = `${key} (Principal)`;
                } else if (map.price_alt_keys.includes(key)) {
                  label = `${key} (Alternativo)`;
                } else if (key === map.quantity_key) {
                  label = `${key} (Cantidad)`;
                }
                return (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                );
              })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
