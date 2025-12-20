import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DollarSign, RefreshCw, Info, AlertCircle } from "lucide-react";
import { MappingConfig } from "@/components/suppliers/ListConfigurationView";

function formatArgentinaTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const argentinaDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const hours = String(argentinaDate.getHours()).padStart(2, "0");
    const minutes = String(argentinaDate.getMinutes()).padStart(2, "0");
    const seconds = String(argentinaDate.getSeconds()).padStart(2, "0");
    const day = String(argentinaDate.getDate()).padStart(2, "0");
    const month = String(argentinaDate.getMonth() + 1).padStart(2, "0");
    const year = argentinaDate.getFullYear();
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return "No disponible";
  }
}

interface DollarConversionTabProps {
  keys: string[];
  map: MappingConfig;
  setMap: React.Dispatch<React.SetStateAction<MappingConfig>>;
  officialDollar: { rate: number; venta?: number; compra?: number; source?: string; updatedAt: string } | null | undefined;
  loadingDollar: boolean;
  onRefetchDollar: () => void;
  isNumericColumn: (key: string) => boolean;
}

export function DollarConversionTab({ 
  keys, 
  map, 
  setMap, 
  officialDollar, 
  loadingDollar, 
  onRefetchDollar,
  isNumericColumn 
}: DollarConversionTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">Conversión de Dólar a Pesos</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Si tus precios están en dólares, selecciona las columnas a convertir usando el valor oficial.
        </p>
      </div>

      {/* Current Dollar Rate */}
      <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Dólar Oficial</p>
            {loadingDollar ? (
              <p className="text-lg font-bold">Cargando...</p>
            ) : officialDollar ? (
              <>
                <p className="text-2xl font-bold text-primary">${officialDollar.rate.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  Actualizado: {formatArgentinaTime(officialDollar.updatedAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive">No disponible</p>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRefetchDollar}
          disabled={loadingDollar}
        >
          <RefreshCw className={`h-5 w-5 ${loadingDollar ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Conversión Automática</AlertTitle>
        <AlertDescription>
          El valor del dólar se actualiza automáticamente todos los días a las 6:00 AM. 
          Puedes actualizarlo manualmente pulsando el ícono de actualización.
        </AlertDescription>
      </Alert>

      {/* Column Selection */}
      {officialDollar && (
        <div className="space-y-3">
          <div>
            <Label className="text-base font-semibold">Columnas a Convertir (USD → ARS)</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Se multiplicarán por el valor oficial: ${officialDollar.rate.toFixed(2)}
            </p>
          </div>
          <ScrollArea className="h-[250px] border rounded-lg p-3 bg-muted/30">
            {keys
              .filter((k) => isNumericColumn(k))
              .map((key) => {
                const isSelected = map.dollar_conversion?.target_columns.includes(key);
                return (
                  <div key={key} className="flex items-center space-x-3 py-2">
                    <Checkbox
                      id={`dollar-col-${key}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        setMap((prev) => {
                          const current = prev.dollar_conversion?.target_columns || [];
                          const updated = checked
                            ? [...current, key]
                            : current.filter((k) => k !== key);
                          return {
                            ...prev,
                            dollar_conversion: { target_columns: updated },
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
          {(map.dollar_conversion?.target_columns.length ?? 0) > 0 && (
            <p className="text-xs text-green-600 font-medium">
              ✓ {map.dollar_conversion?.target_columns.length} columna(s) seleccionada(s)
            </p>
          )}
        </div>
      )}

      {/* No Dollar Configured */}
      {(!officialDollar || officialDollar.rate === 0) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Conversión no disponible</AlertTitle>
          <AlertDescription>
            El valor del dólar oficial aún no está configurado en el sistema. 
            La conversión automática estará disponible una vez que se actualice el valor.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
