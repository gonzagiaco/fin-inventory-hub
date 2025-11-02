import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type MappingConfig = {
  code_keys: string[];
  name_keys: string[];
  quantity_key: string | null;
  price_primary_key: string | null;
  price_alt_keys: string[];
  extra_index_keys: string[];
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
  });

  const queryClient = useQueryClient();

  // Cargar 20 filas de ejemplo para listar claves
  useEffect(() => {
    let isCancelled = false;

    const loadSample = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from("dynamic_products").select("data").eq("list_id", listId).limit(20);

        if (error) throw error;
        if (isCancelled) return;

        setSample(data ?? []);
        const k = new Set<string>();
        (data ?? []).forEach((row) => Object.keys(row.data || {}).forEach((kk) => k.add(kk)));
        setKeys(Array.from(k).sort());
      } catch (error) {
        console.error("Error loading sample:", error);
        toast.error("Error al cargar las columnas disponibles");
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
      await queryClient.invalidateQueries({ queryKey: ["product-lists-index"] });
      await queryClient.invalidateQueries({ queryKey: ["list-products", listId] });

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
            <span className="text-xs text-muted-foreground ml-2">(selecciona una o más)</span>
          </Label>
          <Select
            value={map.code_keys[0] ?? "__none__"}
            onValueChange={(value) => {
              setMap((m) => ({ ...m, code_keys: value === "__none__" ? [] : [value] }));
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
            <span className="text-xs text-muted-foreground ml-2">(selecciona una o más)</span>
          </Label>
          <ScrollArea className="h-32 rounded-md border p-3">
            <div className="space-y-2">
              {keys.map((k) => (
                <div key={k} className="flex items-center space-x-2">
                  <Checkbox
                    id={`name-${k}`}
                    checked={map.name_keys.includes(k)}
                    onCheckedChange={(checked) => {
                      setMap((m) => ({
                        ...m,
                        name_keys: checked ? [...m.name_keys, k] : m.name_keys.filter((nk) => nk !== k),
                      }));
                    }}
                    disabled={isSaving}
                  />
                  <label htmlFor={`name-${k}`} className="text-sm cursor-pointer">
                    {k}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
          {map.name_keys.length > 0 && (
            <p className="text-xs text-muted-foreground">Seleccionadas: {map.name_keys.join(", ")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity-key">Clave de CANTIDAD (stock)</Label>
          <Select
            onValueChange={(v) => setMap((m) => ({ ...m, quantity_key: v === "__none__" ? null : v }))}
            value={map.quantity_key ?? "__none__"}
            disabled={isSaving}
          >
            <SelectTrigger id="quantity-key">
              <SelectValue placeholder="Seleccionar clave (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin cantidad</SelectItem>
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
            onValueChange={(v) => setMap((m) => ({ ...m, price_primary_key: v === "__none__" ? null : v }))}
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

      <div className="rounded-lg border bg-muted/50 p-4">
        <p className="text-xs font-medium mb-2">Columnas detectadas ({keys.length}):</p>
        <div className="flex flex-wrap gap-2">
          {keys.map((k) => (
            <code key={k} className="text-xs bg-background px-2 py-1 rounded">
              {k}
            </code>
          ))}
        </div>
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
