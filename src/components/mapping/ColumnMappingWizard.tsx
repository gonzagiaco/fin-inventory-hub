import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "../ui/input";

type MappingConfig = {
  code_keys: string[];
  name_keys: string[];
  quantity_key: string | null;
  price_primary_key: string | null;
  price_alt_keys: string[];
  extra_index_keys: string[];
  price_modifiers?: {
    general: { percentage: number; add_vat: boolean; vat_rate?: number };
    overrides: Record<
      string,
      { percentage: number; add_vat: boolean; vat_rate?: number }
    >;
  };
};

type Props = {
  listId: string;
  onSaved?: () => void;
};

export function ColumnMappingWizard({ listId, onSaved }: Props) {
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
    price_modifiers: {
      // Default: no percentage change, no agregar IVA y VAT rate por defecto 21%
      general: { percentage: 0, add_vat: false, vat_rate: 21 },
      overrides: {},
    },
  });

  const queryClient = useQueryClient();

  // Cargar 20 filas de ejemplo para listar claves
  useEffect(() => {
    let isCancelled = false;

    const loadSample = async () => {
      setIsLoading(true);
      try {
        const [
          { data: sampleData, error: sampleError },
          { data: configData, error: configError },
        ] = await Promise.all([
          supabase
            .from("dynamic_products")
            .select("data")
            .eq("list_id", listId)
            .limit(20),
          supabase
            .from("product_lists")
            .select("mapping_config")
            .eq("id", listId)
            .single(),
        ]);

        if (sampleError) throw sampleError;
        if (configError) throw configError;
        if (isCancelled) return;

        setSample(sampleData ?? []);
        const k = new Set<string>();
        (sampleData ?? []).forEach((row) =>
          Object.keys(row.data || {}).forEach((kk) => k.add(kk))
        );
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

    setIsSaving(true);
    try {
      console.log("Guardando mapping_config:", map);

      // 1. Guardar mapping_config
      const { error: updateError } = await supabase
        .from("product_lists")
        .update({ mapping_config: map })
        .eq("id", listId);

      if (updateError) {
        console.error("Error al actualizar product_lists:", updateError);
        throw new Error(
          `Error al guardar configuración: ${updateError.message}`
        );
      }

      console.log("Mapping guardado, refrescando índice...");

      // 2. Refrescar índice
      const { data: rpcData, error: refreshError } = await supabase.rpc(
        "refresh_list_index",
        { p_list_id: listId }
      );

      if (refreshError) {
        console.error("Error al refrescar índice:", refreshError);
        throw new Error(`Error al indexar productos: ${refreshError.message}`);
      }

      console.log("Índice refrescado exitosamente:", rpcData);

      // 3. Invalidar caché de React Query
      await queryClient.invalidateQueries({
        queryKey: ["product-lists-index"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["list-products", listId],
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
          <Label>
            Claves para CÓDIGO
            <span className="text-xs text-muted-foreground ml-2">
              (selecciona una o más)
            </span>
          </Label>
          <Select
            value={map.code_keys[0] ?? "__none__"}
            onValueChange={(value) => {
              setMap((m) => ({
                ...m,
                code_keys: value === "__none__" ? [] : [value],
              }));
            }}
            disabled={isSaving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar clave para código" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin código</SelectItem>
              {keys.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>
            Claves para NOMBRE/DESCRIPCIÓN
            <span className="text-xs text-muted-foreground ml-2">
              (selecciona una o más)
            </span>
          </Label>
          <Select
            value={map.name_keys[0] ?? "__none__"}
            onValueChange={(value) => {
              setMap((m) => ({
                ...m,
                name_keys: value === "__none__" ? [] : [value],
              }));
            }}
            disabled={isSaving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar clave para nombre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin nombre</SelectItem>
              {keys.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <pre className="mt-3 max-h-64 overflow-auto text-xs">
            {JSON.stringify(sample, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
