import { useState, useRef, useMemo } from "react";
import { useListProducts } from "@/hooks/useListProducts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, ChevronDown, ChevronRight, Trash2, AlertTriangle, FileText, Settings } from "lucide-react";
import { useProductLists } from "@/hooks/useProductLists";
import { useProductListStore } from "@/stores/productListStore";
import { DynamicProductTable } from "./DynamicProductTable";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ColumnSchema, DynamicProduct } from "@/types/productList";
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
import { ListUpdateDialog } from "./ListUpdateDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ColumnMappingWizard } from "./mapping/ColumnMappingWizard";
import { parseNumber } from "@/utils/numberParser";

interface SupplierProductListsProps {
  supplierId: string;
  supplierName: string;
}

const SupplierListProducts = ({
  listId,
  columnSchema,
  onAddToRequest,
}: {
  listId: string;
  columnSchema: ColumnSchema[];
  onAddToRequest?: (product: DynamicProduct) => void;
}) => {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useListProducts(listId);

  const allProducts: DynamicProduct[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page: any) =>
      (page.data || []).map((item: any) => ({
        id: item.product_id,
        listId: item.list_id,
        code: item.code,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        // si la relación no viene, intenta con item.data
        data: item?.dynamic_products?.data ?? item?.data ?? {},
      })),
    );
  }, [data]);

  if (isLoading) {
    return <div className="p-6 text-center">Cargando productos...</div>;
  }

  return (
    <DynamicProductTable
      listId={listId}
      products={allProducts}
      columnSchema={columnSchema}
      onAddToRequest={onAddToRequest}
      showStockActions
      onLoadMore={() => {
        void fetchNextPage();
      }}
      hasMore={!!hasNextPage}
      isLoadingMore={!!isFetchingNextPage}
    />
  );
};

export const SupplierProductLists = ({ supplierId, supplierName }: SupplierProductListsProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [listToMap, setListToMap] = useState<string | null>(null);
  const [similarWarning, setSimilarWarning] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    fileName: string;
    columnSchema: ColumnSchema[];
    products: DynamicProduct[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { productLists, isLoading, createList, deleteList, updateList, findSimilarList } = useProductLists(supplierId);
  const { collapsedLists, toggleListCollapse } = useProductListStore();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // Call edge function to process document
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

      // Extract all unique column keys
      const allKeys = new Set<string>();
      productos.forEach((prod: any) => {
        Object.keys(prod).forEach((key) => allKeys.add(key));
      });

      // Create column schema
      const standardKeys = ["code", "name", "descripcion", "price", "precio", "cantidad"];
      const columnSchema: ColumnSchema[] = [];
      let order = 0;

      // Add "Stock Disponible" column first (system column)
      columnSchema.push({
        key: "quantity",
        label: "Stock Disponible",
        type: "number",
        visible: true,
        order: order++,
        isStandard: true,
      });

      // Add standard columns
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

      // Add extra columns
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

      // Transform products
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

        // Si no pudimos parsear, mejor guardar null para la columna numérica en la DB
        const price = Number.isFinite(parsedPrice) ? parsedPrice : null;

        return {
          id: crypto.randomUUID(),
          listId: "", // Will be set by backend
          code: prod.code,
          name: prod.name || prod.descripcion,
          price,
          quantity: prod.cantidad,
          data,
        };
      });

      // Check if there are existing lists for this supplier
      if (productLists.length > 0) {
        // Show dialog to let user choose
        setPendingUpload({
          fileName: file.name,
          columnSchema,
          products: dynamicProducts,
        });
      } else {
        // Create new list directly if no lists exist
        createList({
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

    await updateList({
      listId,
      fileName: pendingUpload.fileName,
      columnSchema: pendingUpload.columnSchema,
      products: pendingUpload.products,
    });

    // Refrescar índice para ver precios redondeados/modificados de inmediato
    await supabase.rpc("refresh_list_index", { p_list_id: listId });

    setPendingUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateNew = async () => {
    if (!pendingUpload) return;

    const created = await createList({
      supplierId,
      name: `${pendingUpload.fileName} - ${new Date().toLocaleDateString()}`,
      fileName: pendingUpload.fileName,
      fileType: pendingUpload.fileName.split(".").pop() || "unknown",
      columnSchema: pendingUpload.columnSchema,
      products: pendingUpload.products,
    });

    // ⚠️ Asegurate que createList devuelva { id: string }
    if (created?.id) {
      await supabase.rpc("refresh_list_index", { p_list_id: created.id });
    }

    setPendingUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
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

            return (
              <Card key={list.id} className="glassmorphism border-primary/20">
                <CardHeader className="cursor-pointer" onClick={() => toggleListCollapse(list.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{list.name}</CardTitle>
                          {(list as any).mapping_config && (
                            <Badge variant="default" className="text-xs">
                              ✓ Mapeado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {list.fileType.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(list.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-muted-foreground">{list.productCount} productos</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setListToMap(list.id);
                        }}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Mapeo
                      </Button>
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
                    </div>
                  </div>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent>
                    <SupplierListProducts listId={list.id} columnSchema={list.columnSchema} />
                  </CardContent>
                )}
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

      {/* Mapping Wizard Dialog */}
      <Dialog open={!!listToMap} onOpenChange={(open) => !open && setListToMap(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Mapeo de Columnas</DialogTitle>
          </DialogHeader>
          {listToMap && (
            <ColumnMappingWizard
              listId={listToMap}
              onSaved={() => {
                setListToMap(null);
                toast.success("Mapeo guardado e índice actualizado");
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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
};
