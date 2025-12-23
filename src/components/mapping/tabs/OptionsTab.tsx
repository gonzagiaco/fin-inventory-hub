import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MappingConfig } from "@/components/suppliers/ListConfigurationView";

interface OptionsTabProps {
  keys: string[];
  map: MappingConfig;
  setMap: React.Dispatch<React.SetStateAction<MappingConfig>>;
  isNumericColumn: (key: string) => boolean;
}

export function OptionsTab({ keys, map, setMap, isNumericColumn }: OptionsTabProps) {
  const customColumnNames = Object.keys(map.custom_columns || {});

  const getPriceColumnOptions = () => {
    const options: { key: string; label: string }[] = [];

    keys.forEach((key) => {
      const isCustom = customColumnNames.includes(key);
      const isNumeric = isNumericColumn(key);

      if (isNumeric || isCustom) {
        let label = key;
        if (isCustom) {
          label = `${key} (Calculada)`;
        } else if (key === map.price_primary_key) {
          label = `${key} (Principal)`;
        } else if (map.price_alt_keys.includes(key)) {
          label = `${key} (Alternativo)`;
        } else if (key === map.quantity_key) {
          label = `${key} (Cantidad)`;
        }
        options.push({ key, label });
      }
    });

    return options;
  };

  const priceOptions = getPriceColumnOptions();

  return (
    <div className="space-y-6">
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
            {priceOptions.map(({ key, label }) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Delivery Note Price Column */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div>
          <Label className="text-base font-semibold">Columna de Precio para Remitos</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Esta columna se usará cuando agregues productos a un remito. Si no se selecciona, se usará el precio principal.
          </p>
        </div>
        <Select
          value={map.delivery_note_price_column || "__default__"}
          onValueChange={(value) => setMap({ ...map, delivery_note_price_column: value === "__default__" ? null : value })}
        >
          <SelectTrigger className="max-w-[300px]">
            <SelectValue placeholder="Usar precio principal (por defecto)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Usar precio principal (por defecto)</SelectItem>
            {priceOptions.map(({ key, label }) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
