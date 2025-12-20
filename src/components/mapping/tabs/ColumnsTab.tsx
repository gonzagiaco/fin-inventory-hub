import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MappingConfig } from "@/components/suppliers/ListConfigurationView";

interface ColumnsTabProps {
  keys: string[];
  map: MappingConfig;
  setMap: React.Dispatch<React.SetStateAction<MappingConfig>>;
  isSaving: boolean;
}

export function ColumnsTab({ keys, map, setMap, isSaving }: ColumnsTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Code Keys */}
        <div className="space-y-3">
          <div>
            <Label className="text-base font-semibold">Campos de Código</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Selecciona las columnas que contienen el código del producto. El sistema usará la primera con datos.
            </p>
          </div>
          <ScrollArea className="h-[200px] border rounded-lg p-3 bg-muted/30">
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key} className="flex items-center space-x-3 py-1">
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
                    className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {key}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            {map.code_keys.length > 0
              ? `✓ ${map.code_keys.length} campo(s): ${map.code_keys.join(", ")}`
              : "⚠️ Sin campos seleccionados"}
          </p>
        </div>

        {/* Name Keys */}
        <div className="space-y-3">
          <div>
            <Label className="text-base font-semibold">Campos de Nombre/Descripción</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Selecciona las columnas que contienen el nombre o descripción. El sistema usará la primera con datos.
            </p>
          </div>
          <ScrollArea className="h-[200px] border rounded-lg p-3 bg-muted/30">
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key} className="flex items-center space-x-3 py-1">
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
                  <label
                    htmlFor={`name-${key}`}
                    className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {key}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            {map.name_keys.length > 0
              ? `✓ ${map.name_keys.length} campo(s): ${map.name_keys.join(", ")}`
              : "⚠️ Sin campos seleccionados"}
          </p>
        </div>
      </div>
    </div>
  );
}
