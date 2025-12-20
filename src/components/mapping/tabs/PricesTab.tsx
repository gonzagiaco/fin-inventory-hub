import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MappingConfig } from "@/components/suppliers/ListConfigurationView";

interface PricesTabProps {
  keys: string[];
  map: MappingConfig;
  setMap: React.Dispatch<React.SetStateAction<MappingConfig>>;
  isSaving: boolean;
  isNumericColumn: (key: string) => boolean;
}

export function PricesTab({ keys, map, setMap, isSaving, isNumericColumn }: PricesTabProps) {
  return (
    <div className="space-y-6">
      {/* Primary Price Key */}
      <div className="space-y-3">
        <div>
          <Label className="text-base font-semibold">Columna de Precio Principal</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Selecciona la columna que contiene el precio principal del producto.
          </p>
        </div>
        <Select
          onValueChange={(v) =>
            setMap((m) => ({
              ...m,
              price_primary_key: v === "__none__" ? null : v,
            }))
          }
          value={map.price_primary_key ?? "__none__"}
          disabled={isSaving}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar columna (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin precio</SelectItem>
            {keys.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Alternative Price Columns */}
      <div className="space-y-3">
        <div>
          <Label className="text-base font-semibold">Columnas Adicionales de Precio</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Se formatearán igual que el precio principal (parseo y símbolo $).
          </p>
        </div>
        <ScrollArea className="h-[150px] border rounded-lg p-3 bg-muted/30">
          {keys
            .filter((key) => isNumericColumn(key) && key !== map.price_primary_key)
            .map((columnKey) => {
              const isChecked = map.price_alt_keys.includes(columnKey);
              return (
                <div key={columnKey} className="flex items-center gap-3 py-2">
                  <Checkbox
                    id={`price-alt-${columnKey}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      setMap((prev) => {
                        const next = checked
                          ? Array.from(new Set([...(prev.price_alt_keys ?? []), columnKey]))
                          : (prev.price_alt_keys ?? []).filter((k) => k !== columnKey);
                        return { ...prev, price_alt_keys: next };
                      });
                    }}
                  />
                  <label htmlFor={`price-alt-${columnKey}`} className="text-sm cursor-pointer">
                    {columnKey}
                  </label>
                </div>
              );
            })}
        </ScrollArea>
        <p className="text-xs text-muted-foreground">
          {map.price_alt_keys.length > 0
            ? `✓ ${map.price_alt_keys.length} columna(s) seleccionada(s)`
            : "Sin columnas adicionales"}
        </p>
      </div>

      {/* Global Price Modifiers */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <Label className="text-base font-semibold">Modificadores de Precio Globales</Label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Descuento/Adición:</Label>
            <Input
              type="number"
              value={map.price_modifiers?.general.percentage ?? 0}
              onChange={(e) => {
                const pct = parseFloat(e.target.value) || 0;
                setMap((m) => ({
                  ...m,
                  price_modifiers: {
                    ...m.price_modifiers!,
                    general: { ...m.price_modifiers!.general, percentage: pct },
                  },
                }));
              }}
              className="w-20"
            />
            <span className="text-sm">%</span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={map.price_modifiers?.general.add_vat ?? false}
              onCheckedChange={(checked) => {
                setMap((m) => ({
                  ...m,
                  price_modifiers: {
                    ...m.price_modifiers!,
                    general: { ...m.price_modifiers!.general, add_vat: Boolean(checked) },
                  },
                }));
              }}
            />
            <Label className="text-sm">Agregar IVA:</Label>
            <Input
              type="number"
              value={map.price_modifiers?.general.vat_rate ?? 21}
              onChange={(e) => {
                const rate = parseFloat(e.target.value) || 0;
                setMap((m) => ({
                  ...m,
                  price_modifiers: {
                    ...m.price_modifiers!,
                    general: { ...m.price_modifiers!.general, vat_rate: rate },
                  },
                }));
              }}
              className="w-20"
            />
            <span className="text-sm">%</span>
          </div>
        </div>
      </div>

      {/* Per-Column Overrides */}
      <div className="space-y-3">
        <div>
          <Label className="text-base font-semibold">Modificadores por Columna</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Aplica modificadores específicos para columnas individuales.
          </p>
        </div>
        <ScrollArea className="h-[200px] border rounded-lg p-3 bg-muted/30">
          {keys
            .filter((k) => k !== map.price_primary_key)
            .map((columnKey) => (
              <div key={columnKey} className="flex flex-wrap items-center gap-2 py-2 border-b last:border-0">
                <Checkbox
                  checked={!!map.price_modifiers?.overrides[columnKey]}
                  onCheckedChange={(checked) => {
                    setMap((m) => {
                      const overrides = { ...(m.price_modifiers?.overrides || {}) };
                      if (checked) {
                        overrides[columnKey] = overrides[columnKey] || { percentage: 0, add_vat: false };
                      } else {
                        delete overrides[columnKey];
                      }
                      return {
                        ...m,
                        price_modifiers: { ...m.price_modifiers!, overrides },
                      };
                    });
                  }}
                />
                <Label className="text-sm min-w-[100px]">{columnKey}</Label>
                {map.price_modifiers?.overrides[columnKey] && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="number"
                      value={map.price_modifiers.overrides[columnKey].percentage}
                      onChange={(e) => {
                        const pct = parseFloat(e.target.value) || 0;
                        setMap((m) => ({
                          ...m,
                          price_modifiers: {
                            ...m.price_modifiers!,
                            overrides: {
                              ...m.price_modifiers!.overrides,
                              [columnKey]: { ...m.price_modifiers!.overrides[columnKey], percentage: pct },
                            },
                          },
                        }));
                      }}
                      className="w-16"
                    />
                    <span className="text-sm">%</span>
                    <Checkbox
                      checked={map.price_modifiers.overrides[columnKey].add_vat}
                      onCheckedChange={(checked) => {
                        setMap((m) => ({
                          ...m,
                          price_modifiers: {
                            ...m.price_modifiers!,
                            overrides: {
                              ...m.price_modifiers!.overrides,
                              [columnKey]: { ...m.price_modifiers!.overrides[columnKey], add_vat: Boolean(checked) },
                            },
                          },
                        }));
                      }}
                    />
                    <Input
                      type="number"
                      value={
                        map.price_modifiers.overrides[columnKey].vat_rate ??
                        map.price_modifiers?.general.vat_rate ??
                        21
                      }
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value) || 0;
                        setMap((m) => ({
                          ...m,
                          price_modifiers: {
                            ...m.price_modifiers!,
                            overrides: {
                              ...m.price_modifiers!.overrides,
                              [columnKey]: { ...m.price_modifiers!.overrides[columnKey], vat_rate: rate },
                            },
                          },
                        }));
                      }}
                      className="w-16"
                    />
                    <span className="text-sm">% IVA</span>
                  </div>
                )}
              </div>
            ))}
        </ScrollArea>
      </div>
    </div>
  );
}
