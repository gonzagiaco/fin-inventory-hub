import { useState, useRef, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, ChevronDown, ChevronRight, Trash2, AlertTriangle, FileText, Settings } from "lucide-react";
import { useProductLists } from "@/hooks/useProductLists";
import { useProductListStore } from "@/stores/productListStore";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ColumnSchema, DynamicProduct, ProductList } from "@/types/productList";
import { mergeColumnSchemas, detectNewColumnsFromProducts, createSchemaFromKeys } from "@/utils/columnSchemaUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ListUpdateDialog } from "@/components/ListUpdateDialog";
import { parseNumber } from "@/utils/numberParser";
import { useIsMobile } from "@/hooks/use-mobile";

interface SupplierListsViewProps {
  supplierId: string;
  supplierName: string;
  onConfigureList: (listId: string, listName: string) => void;
}

export function SupplierListsView({ supplierId, supplierName, onConfigureList }: SupplierListsViewProps) {
  const [isUploading, setIsUploading] = useState(false);
  const isMobile = useIsMobile();
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [similarWarning, setSimilarWarning] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    fileName: string;
    columnSchema: ColumnSchema[];
    products: DynamicProduct[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { productLists, isLoading, createList, deleteList, updateList } = useProductLists(supplierId);
  const { collapsedLists, toggleListCollapse, initializeCollapsedState } = useProductListStore();

  useEffect(() => {
    if (productLists.length > 0) {
      const listIds = productLists.map((list) => list.id);
      initializeCollapsedState(listIds);
    }
  }, [productLists, initializeCollapsedState]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplierId", supplierId);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Error al procesar el documento");
      }

      const result = await response.json();
      const productos = result.productos || [];

      if (productos.length === 0) {
        toast.error("No se encontraron productos válidos en el archivo");
        return;
      }

      const allKeys = new Set<string>();
      productos.forEach((prod: any) => {
        Object.keys(prod).forEach((key) => allKeys.add(key));
      });

      const standardKeys = ["code", "name", "descripcion", "price", "precio", "cantidad"];
      const columnSchema: ColumnSchema[] = [];
      let order = 0;

      columnSchema.push({
        key: "quantity",
        label: "Stock Disponible",
        type: "number",
        visible: true,
        order: order++,
        isStandard: true,
      });

      if (allKeys.has("code")) {
        columnSchema.push({
          key: "code",
          label: "Código",
          type: "text",
          visible: true,
          order: order++,
          isStandard: true,
        });
      }

      if (allKeys.has("name") || allKeys.has("descripcion")) {
        const nameKey = allKeys.has("name") ? "name" : "descripcion";
        columnSchema.push({
          key: nameKey,
          label: "Nombre",
          type: "text",
          visible: true,
          order: order++,
          isStandard: true,
        });
      }

      if (allKeys.has("price") || allKeys.has("precio")) {
        const priceKey = allKeys.has("price") ? "price" : "precio";
        columnSchema.push({
          key: priceKey,
          label: "Precio",
          type: "number",
          visible: true,
          order: order++,
          isStandard: true,
        });
      }

      allKeys.forEach((key) => {
        if (!standardKeys.includes(key)) {
          columnSchema.push({
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            type: typeof productos[0][key] === "number" ? "number" : "text",
            visible: true,
            order: order++,
            isStandard: false,
          });
        }
      });

      const dynamicProducts: DynamicProduct[] = productos.map((prod: any) => {
        const data: Record<string, any> = {};
        Object.keys(prod).forEach((key) => {
          if (!["code", "name", "descripcion", "price", "precio", "cantidad"].includes(key)) {
            data[key] = prod[key];
          }
        });

        const rawPrice = prod.price ?? prod.precio;
        const parsedPrice =
          typeof rawPrice === "string" ? parseNumber(rawPrice) : rawPrice == null ? NaN : Number(rawPrice);
        const price = Number.isFinite(parsedPrice) ? parsedPrice : null;

        return {
          id: crypto.randomUUID(),
          listId: "",
          code: prod.code,
          name: prod.name || prod.descripcion,
          price,
          quantity: prod.cantidad,
          data,
        };
      });

      if (productLists.length > 0) {
        setPendingUpload({
          fileName: file.name,
          columnSchema,
          products: dynamicProducts,
        });
      } else {
        void createList({
          supplierId,
          name: `${file.name} - ${new Date().toLocaleDateString()}`,
          fileName: file.name,
          fileType: file.name.split(".").pop() || "unknown",
          columnSchema,
          products: dynamicProducts,
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Error al procesar el archivo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteList = () => {
    if (listToDelete) {
      deleteList(listToDelete);
      setListToDelete(null);
    }
  };

  const handleUpdateExisting = async (listId: string) => {
    if (!pendingUpload) return;

    try {
      const existingList = productLists.find((list) => list.id === listId);
      if (!existingList) {
        toast.error("Lista no encontrada");
        return;
      }

      const mappingConfig = existingList.mapping_config;
      const mappedProducts = pendingUpload.products.map((product) => {
        let extractedCode = product.code;
        let extractedName = product.name;
        let extractedPrice = product.price;

        if (!extractedCode && mappingConfig?.code_keys) {
          for (const key of mappingConfig.code_keys) {
            if (product.data[key]) {
              extractedCode = String(product.data[key]).trim();
              break;
            }
          }
        }

        if (!extractedName && mappingConfig?.name_keys) {
          for (const key of mappingConfig.name_keys) {
            if (product.data[key]) {
              extractedName = String(product.data[key]).trim();
              break;
            }
          }
        }

        if ((extractedPrice === null || extractedPrice === undefined) && mappingConfig?.price_primary_key) {
          const priceValue = product.data[mappingConfig.price_primary_key];
          if (priceValue !== null && priceValue !== undefined) {
            const parsedPrice = typeof priceValue === "string" ? parseNumber(priceValue) : Number(priceValue);
            extractedPrice = Number.isFinite(parsedPrice) ? parsedPrice : null;
          }
        }

        return {
          ...product,
          code: extractedCode,
          name: extractedName,
          price: extractedPrice,
        };
      });

      const newColumnKeys = detectNewColumnsFromProducts(pendingUpload.products);
      const newColumnsSchema = createSchemaFromKeys(
        newColumnKeys,
        Math.max(...existingList.columnSchema.map((c) => c.order), -1) + 1,
      );

      const mergedColumnSchema = mergeColumnSchemas(existingList.columnSchema, newColumnsSchema);

      await updateList({
        listId,
        fileName: pendingUpload.fileName,
        columnSchema: mergedColumnSchema,
        products: mappedProducts,
      });

      await supabase.rpc("refresh_list_index", { p_list_id: listId });

      setPendingUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      toast.success("Lista actualizada correctamente");
    } catch (error: any) {
      console.error("Error actualizando lista:", error);
      toast.error(error.message || "Error al actualizar lista");
    }
  };

  const handleCreateNew = async () => {
    if (!pendingUpload) return;

    try {
      const newColumnKeys = detectNewColumnsFromProducts(pendingUpload.products);
      const detectedSchema = createSchemaFromKeys(newColumnKeys);
      const mergedSchema = mergeColumnSchemas(pendingUpload.columnSchema, detectedSchema);

      const created = await createList({
        supplierId,
        name: `${pendingUpload.fileName} - ${new Date().toLocaleDateString()}`,
        fileName: pendingUpload.fileName,
        fileType: pendingUpload.fileName.split(".").pop() || "unknown",
        columnSchema: mergedSchema,
        products: pendingUpload.products,
      });

      if (created?.id) {
        await supabase.rpc("refresh_list_index", { p_list_id: created.id });
      }

      setPendingUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      console.error("Error creando lista:", error);
      toast.error(error.message || "Error al crear lista");
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando listas...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="glassmorphism border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Nueva Lista de Productos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Soporta archivos Excel (.xlsx, .xls), CSV, PDF y DOCX. El sistema detectará automáticamente las columnas.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.docx"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload-lists"
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full">
            {isUploading ? "Procesando..." : "Seleccionar Archivo"}
          </Button>
        </CardContent>
      </Card>

      {/* Warning */}
      {similarWarning && (
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{similarWarning}</AlertDescription>
        </Alert>
      )}

      {/* Product Lists */}
      {productLists.length === 0 ? (
        <Card className="glassmorphism border-primary/20">
          <CardContent className="py-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No hay listas de productos importadas para {supplierName}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {productLists.map((list) => {
            const isCollapsed = collapsedLists.has(list.id);
            const isMapped = !!list.mapping_config;

            return (
              <Card key={list.id} className="glassmorphism border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader className="cursor-pointer" onClick={() => onConfigureList(list.id, list.name)}>
                  <div className="flex gap-4 items-center justify-between overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <CardTitle className="text-lg truncate" title={list.name}>
                            {list.name}
                          </CardTitle>
                          {!isMapped && (
                            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500 shrink-0">
                              Sin configurar
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {list.fileType.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(list.updatedAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-muted-foreground">{list.productCount} productos</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setListToDelete(list.id);
                        }}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      {/* Update Dialog */}
      <ListUpdateDialog
        open={!!pendingUpload}
        onOpenChange={(open) => !open && setPendingUpload(null)}
        availableLists={productLists}
        newProductCount={pendingUpload?.products.length || 0}
        onUpdate={handleUpdateExisting}
        onCreateNew={handleCreateNew}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!listToDelete} onOpenChange={() => setListToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente la lista y todos sus productos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteList} className="bg-red-500 hover:bg-red-600">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
