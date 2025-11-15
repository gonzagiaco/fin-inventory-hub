import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, RefreshCw, DollarSign, Info, AlertCircle } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Input } from "../ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Hook personalizado para obtener dólar oficial
function useOfficialDollar() {
  return useQuery({
    queryKey: ["dollar-official"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("value, updated_at")
        .eq("key", "dollar_official")
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const value = data.value as any;
      return {
        rate: value.rate || 0,
        venta: value.venta,
        compra: value.compra,
        source: value.source,
        updatedAt: data.updated_at,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 10 * 60 * 1000, // Refetch cada 10 minutos
  });
}

type MappingConfig = {
  code_keys: string[];
  name_keys: string[];
  quantity_key: string | null;
  price_primary_key: string | null;
  price_alt_keys: string[];
  extra_index_keys: string[];
  low_stock_threshold?: number;
  price_modifiers?: {
    general: { percentage: number; add_vat: boolean; vat_rate?: number };
    overrides: Record<string, { percentage: number; add_vat: boolean; vat_rate?: number }>;
  };

  dollar_conversion?: {
    target_columns: string[]; // Columnas donde aplicar conversión
  };
};

type Props = {
  listId: string;
  onSaved?: () => void;
};

export function ColumnMappingWizard({ listId, onSaved }: Props) {
  const { data: officialDollar, isLoading: loadingDollar, refetch: refetchDollar } = useOfficialDollar();
  const [sample, setSample] = useState<any[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [map, setMap] = useState<MappingConfig>({
    code_keys: [],
    name_keys: [],
    quantity_key: null,
    price_primary_key: null,
    price_alt_keys: [],
    extra_index_keys: [],
    low_stock_threshold: 50,
    price_modifiers: {
      // Default: no percentage change, no agregar IVA y VAT rate por defecto 21%
      general: { percentage: 0, add_vat: false, vat_rate: 21 },
      overrides: {},
    },
    dollar_conversion: {
      target_columns: [],
    },
  });

  const isNumericColumn = (columnKey: string): boolean => {
    // Verificar si al menos el 50% de las muestras contienen valores numéricos
    const numericCount = sample.filter((row) => {
      const value = row.data?.[columnKey];
      if (value == null) return false;

      // Intentar parsear como número
      const parsed =
        typeof value === "number"
          ? value
          : parseFloat(
              String(value)
                .replace(/[^0-9.,-]/g, "")
                .replace(",", "."),
            );

      return !isNaN(parsed) && isFinite(parsed);
    }).length;

    return numericCount > 0 && numericCount >= sample.length * 0.5;
  };

  const queryClient = useQueryClient();

  // Cargar 20 filas de ejemplo para listar claves
  useEffect(() => {
    let isCancelled = false;

    const loadSample = async () => {
      setIsLoading(true);
      try {
        const [{ data: sampleData, error: sampleError }, { data: configData, error: configError }] = await Promise.all([
          supabase.from("dynamic_products").select("data").eq("list_id", listId).limit(20),
          supabase.from("product_lists").select("mapping_config").eq("id", listId).single(),
        ]);

        if (sampleError) throw sampleError;
        if (configError) throw configError;
        if (isCancelled) return;

        setSample(sampleData ?? []);
        const k = new Set<string>();
        (sampleData ?? []).forEach((row) => Object.keys(row.data || {}).forEach((kk) => k.add(kk)));
        setKeys(Array.from(k).sort());

        if (configData?.mapping_config) {
          const loaded = configData.mapping_config as MappingConfig;
          setMap((prev) => ({
            ...prev,
            ...loaded,
            price_modifiers: {
              // asegurar defaults si faltan en la configuración almacenada
              general: { percentage: 0, add_vat: false, vat_rate: 21 },
              overrides: {},
              ...loaded.price_modifiers,
            },
          }));
        }
      } catch (error) {
        console.error("Error loading sample or mapping_config:", error);
        toast.error("Error al cargar columnas o configuración previa");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadSample();
    return () => {
      isCancelled = true;
    };
  }, [listId]);

  const handleSave = async () => {
    // Validación básica
    if (map.code_keys.length === 0 && map.name_keys.length === 0) {
      toast.error("Debe seleccionar al menos una clave para código o nombre");
      return;
    }

    if ((map.dollar_conversion?.rate || 0) > 0 && map.dollar_conversion?.target_columns.length === 0) {
      toast.error("Si configuras el valor del dólar, debes seleccionar al menos una columna para convertir");
      return;
    }

    setIsSaving(true);
    try {
      console.log("Guardando mapping_config:", map);

      // 1. Guardar mapping_config
      const { error: updateError } = await supabase
        .from("product_lists")
        .update({ mapping_config: cleanedMapping })
        .eq("id", listId);

      if (updateError) {
        console.error("Error al actualizar product_lists:", updateError);
        throw new Error(`Error al guardar configuración: ${updateError.message}`);
      }

      console.log("Mapping guardado, refrescando índice...");

      // 2. Refrescar índice
      const { data: rpcData, error: refreshError } = await supabase.rpc("refresh_list_index", { p_list_id: listId });

      if (refreshError) {
        console.error("Error al refrescar índice:", refreshError);
        throw new Error(`Error al indexar productos: ${refreshError.message}`);
      }

      console.log("Índice refrescado exitosamente:", rpcData);

      // 3. Invalidar caché de React Query
      await queryClient.invalidateQueries({
        queryKey: ["product-lists-index"],
      });

      // Pequeño delay para asegurar que el índice termine de actualizarse
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Resetear caché completamente para forzar nuevo fetch
      await queryClient.resetQueries({
        queryKey: ["list-products", listId],
        exact: false,
      });

      toast.success("Mapeo guardado e índice actualizado correctamente");
      onSaved?.();
    } catch (error: any) {
      console.error("Error en handleSave:", error);
      toast.error(error.message || "Error al guardar el mapeo");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No se encontraron columnas en esta lista. Importa productos primero.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Campos de Código (múltiples variantes)</Label>
          <p className="text-xs text-muted-foreground">
            Selecciona todas las columnas que pueden contener el código del producto.
            El sistema usará la primera que tenga datos.
          </p>
          <ScrollArea className="h-[120px] border rounded-md p-2">
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`code-${key}`}
                    checked={map.code_keys.includes(key)}
                    onCheckedChange={(checked) => {
                      setMap((prev) => ({
                        ...prev,
                        code_keys: checked
                          ? [...prev.code_keys, key]
                          : prev.code_keys.filter((k) => k !== key),
                      }));
                    }}
                    disabled={isSaving}
                  />
                  <label
                    htmlFor={`code-${key}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {key}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            {map.code_keys.length > 0
              ? `✓ ${map.code_keys.length} campo(s) seleccionado(s): ${map.code_keys.join(", ")}`
              : "⚠️ No hay campos seleccionados"}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Campos de Nombre/Descripción (múltiples variantes)</Label>
          <p className="text-xs text-muted-foreground">
            Selecciona todas las columnas que pueden contener el nombre o descripción.
            El sistema usará la primera que tenga datos.
          </p>
          <ScrollArea className="h-[120px] border rounded-md p-2">
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`name-${key}`}
                    checked={map.name_keys.includes(key)}
                    onCheckedChange={(checked) => {
                      setMap((prev) => ({
                        ...prev,
                        name_keys: checked
                          ? [...prev.name_keys, key]
                          : prev.name_keys.filter((k) => k !== key),
                      }));
                    }}
                    disabled={isSaving}
                  />
                  <label htmlFor={`name-${key}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {key}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            {map.name_keys.length > 0
              ? `✓ ${map.name_keys.length} campo(s) seleccionado(s): ${map.name_keys.join(", ")}`
              : "⚠️ No hay campos seleccionados"}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price-key">Clave de PRECIO (principal)</Label>
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
            <SelectTrigger id="price-key">
              <SelectValue placeholder="Seleccionar clave (opcional)" />
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

        <div className="space-y-2">
          <Label>Descuento/Adición global:</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={map.price_modifiers?.general.percentage ?? 0}
              onChange={(e) => {
                const pct = parseFloat(e.target.value) || 0;
                setMap((m) => ({
                  ...m,
                  price_modifiers: {
                    ...m.price_modifiers!,
                    general: {
                      ...m.price_modifiers!.general,
                      percentage: pct,
                    },
                  },
                }));
              }}
              className="w-20"
            />
            <span>%</span>
            <Checkbox
              checked={map.price_modifiers?.general.add_vat ?? false}
              onCheckedChange={(checked) => {
                setMap((m) => ({
                  ...m,
                  price_modifiers: {
                    ...m.price_modifiers!,
                    general: {
                      ...m.price_modifiers!.general,
                      add_vat: Boolean(checked),
                    },
                  },
                }));
              }}
            />
            {/* Input para tasa de IVA global (porcentaje) */}
            <Input
              type="number"
              value={map.price_modifiers?.general.vat_rate ?? 21}
              onChange={(e) => {
                const rate = parseFloat(e.target.value) || 0;
                setMap((m) => ({
                  ...m,
                  price_modifiers: {
                    ...m.price_modifiers!,
                    general: {
                      ...m.price_modifiers!.general,
                      vat_rate: rate,
                    },
                  },
                }));
              }}
              className="w-20"
            />
            <span className="text-sm">% IVA</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Overrides por columna:</Label>
        {keys
          .filter((k) => k !== map.price_primary_key)
          .map((columnKey) => (
            <div key={columnKey} className="flex items-center gap-2">
              <Checkbox
                checked={!!map.price_modifiers?.overrides[columnKey]}
                onCheckedChange={(checked) => {
                  setMap((m) => {
                    const overrides = {
                      ...(m.price_modifiers?.overrides || {}),
                    };
                    if (checked) {
                      overrides[columnKey] = overrides[columnKey] || {
                        percentage: 0,
                        add_vat: false,
                      };
                    } else {
                      delete overrides[columnKey];
                    }
                    return {
                      ...m,
                      price_modifiers: {
                        ...m.price_modifiers!,
                        overrides,
                      },
                    };
                  });
                }}
              />
              <Label>{columnKey}</Label>
              {map.price_modifiers?.overrides[columnKey] && (
                <>
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
                            [columnKey]: {
                              ...m.price_modifiers!.overrides[columnKey],
                              percentage: pct,
                            },
                          },
                        },
                      }));
                    }}
                    className="w-16 text-sm"
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
                            [columnKey]: {
                              ...m.price_modifiers!.overrides[columnKey],
                              add_vat: Boolean(checked),
                            },
                          },
                        },
                      }));
                    }}
                  />
                  {/* Input para tasa de IVA específica del override (opcional) */}
                  <Input
                    type="number"
                    value={
                      map.price_modifiers.overrides[columnKey].vat_rate ?? map.price_modifiers?.general.vat_rate ?? 21
                    }
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value) || 0;
                      setMap((m) => ({
                        ...m,
                        price_modifiers: {
                          ...m.price_modifiers!,
                          overrides: {
                            ...m.price_modifiers!.overrides,
                            [columnKey]: {
                              ...m.price_modifiers!.overrides[columnKey],
                              vat_rate: rate,
                            },
                          },
                        },
                      }));
                    }}
                    className="w-16 text-sm"
                  />
                  <span className="text-sm">% IVA</span>
                </>
              )}
            </div>
          ))}
      </div>

      {/* Conversión de Dólar a Pesos */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="space-y-2">
          <Label htmlFor="dollar_rate" className="text-base font-semibold">
            Conversión de Dólar a Pesos
          </Label>
          <p className="text-sm text-muted-foreground">
            Si tus precios están en dólares, configura el valor del dólar y selecciona las columnas a convertir.
          </p>
        </div>

        {/* Input del valor del dólar */}
        <div className="space-y-2">
          <Label htmlFor="dollar_rate">Valor del Dólar (en pesos)</Label>
          <Input
            id="dollar_rate"
            type="number"
            min={0}
            step={0.01}
            placeholder="Ej: 1400"
            value={map.dollar_conversion?.rate || 0}
            onChange={(e) => {
              const rate = Number(e.target.value) || 0;
              setMap((prev) => ({
                ...prev,
                dollar_conversion: {
                  ...prev.dollar_conversion,
                  rate,
                  target_columns: prev.dollar_conversion?.target_columns || [],
                },
              }));
            }}
          />
          <p className="text-xs text-muted-foreground">Dejar en 0 para deshabilitar la conversión</p>
        </div>

        {/* Selección de columnas donde aplicar */}
        {(map.dollar_conversion?.rate || 0) > 0 && (
          <div className="space-y-3">
            <Label>Columnas a convertir (múltiple selección)</Label>
            <ScrollArea className="h-[200px] border rounded-md p-3">
              {keys
                .filter((k) => isNumericColumn(k))
                .map((key) => {
                  const isSelected = map.dollar_conversion?.target_columns.includes(key);
                  return (
                    <div key={key} className="flex items-center space-x-2 py-2">
                      <Checkbox
                        id={`dollar-col-${key}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          setMap((prev) => {
                            const current = prev.dollar_conversion?.target_columns || [];
                            const updated = checked ? [...current, key] : current.filter((k) => k !== key);
                            return {
                              ...prev,
                              dollar_conversion: {
                                rate: prev.dollar_conversion?.rate || 0,
                                target_columns: updated,
                              },
                            };
                          });
                        }}
                      />
                      <label htmlFor={`dollar-col-${key}`} className="text-sm font-medium cursor-pointer">
                        {key}
                      </label>
                    </div>
                  );
                })}
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              Selecciona las columnas que contienen precios en dólares. Se multiplicarán por{" "}
              {map.dollar_conversion?.rate || 0}.
            </p>
          </div>
        )}
      </div>

      {/* Umbral de Bajo Stock */}
      <div className="space-y-2">
        <Label htmlFor="low_stock_threshold">Umbral de Bajo Stock</Label>
        <Input
          id="low_stock_threshold"
          type="number"
          min={0}
          value={map.low_stock_threshold?.toString() ?? ""}
          onChange={(e) => {
            const raw = e.target.value;

            // Si está vacío, dejamos undefined para que el usuario termine de escribir
            if (raw === "") {
              setMap((prev) => ({
                ...prev,
                low_stock_threshold: undefined,
              }));
              return;
            }

            const parsed = Number(raw);
            if (!Number.isNaN(parsed) && parsed >= 0) {
              setMap((prev) => ({
                ...prev,
                low_stock_threshold: parsed,
              }));
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Los productos con cantidad menor a este valor se marcarán como "Bajo Stock" (por defecto: 50)
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar mapeo y refrescar índice"
          )}
        </Button>
      </div>

      {sample.length > 0 && (
        <details className="rounded-lg border bg-muted/50 p-4">
          <summary className="text-xs font-medium cursor-pointer">
            Vista previa de datos (primeras {sample.length} filas)
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto text-xs">{JSON.stringify(sample, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
