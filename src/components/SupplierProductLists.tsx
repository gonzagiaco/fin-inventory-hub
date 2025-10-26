import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  ChevronDown,
  ChevronRight,
  Trash2,
  AlertTriangle,
  FileText,
} from "lucide-react";
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

interface SupplierProductListsProps {
  supplierId: string;
  supplierName: string;
}

export const SupplierProductLists = ({
  supplierId,
  supplierName,
}: SupplierProductListsProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [similarWarning, setSimilarWarning] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    fileName: string;
    columnSchema: ColumnSchema[];
    products: DynamicProduct[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { productLists, productsMap, isLoading, createList, deleteList, updateList, findSimilarList } =
    useProductLists(supplierId);
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

      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

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
      const standardKeys = ['code', 'name', 'descripcion', 'price', 'precio', 'cantidad'];
      const columnSchema: ColumnSchema[] = [];
      let order = 0;

      // Add "Stock Disponible" column first (system column)
      columnSchema.push({
        key: 'quantity',
        label: 'Stock Disponible',
        type: 'number',
        visible: true,
        order: order++,
        isStandard: true,
      });

      // Add standard columns
      if (allKeys.has('code')) {
        columnSchema.push({
          key: 'code',
          label: 'Código',
          type: 'text',
          visible: true,
          order: order++,
          isStandard: true,
        });
      }
      
      if (allKeys.has('name') || allKeys.has('descripcion')) {
        const nameKey = allKeys.has('name') ? 'name' : 'descripcion';
        columnSchema.push({
          key: nameKey,
          label: 'Nombre',
          type: 'text',
          visible: true,
          order: order++,
          isStandard: true,
        });
      }

      if (allKeys.has('price') || allKeys.has('precio')) {
        const priceKey = allKeys.has('price') ? 'price' : 'precio';
        columnSchema.push({
          key: priceKey,
          label: 'Precio',
          type: 'number',
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
            type: typeof productos[0][key] === 'number' ? 'number' : 'text',
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
          if (!['code', 'name', 'descripcion', 'price', 'precio', 'cantidad'].includes(key)) {
            data[key] = prod[key];
          }
        });

        return {
          id: crypto.randomUUID(),
          listId: '', // Will be set by backend
          code: prod.code,
          name: prod.name || prod.descripcion,
          price: prod.price || prod.precio,
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
          fileType: file.name.split('.').pop() || 'unknown',
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

  const handleUpdateExisting = (listId: string) => {
    if (pendingUpload) {
      updateList({
        listId,
        fileName: pendingUpload.fileName,
        columnSchema: pendingUpload.columnSchema,
        products: pendingUpload.products,
      });
      setPendingUpload(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCreateNew = () => {
    if (pendingUpload) {
      createList({
        supplierId,
        name: `${pendingUpload.fileName} - ${new Date().toLocaleDateString()}`,
        fileName: pendingUpload.fileName,
        fileType: pendingUpload.fileName.split('.').pop() || 'unknown',
        columnSchema: pendingUpload.columnSchema,
        products: pendingUpload.products,
      });
      setPendingUpload(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
            Soporta archivos Excel (.xlsx, .xls), CSV, PDF y DOCX. El sistema
            detectará automáticamente las columnas.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.docx"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload-lists"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
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
            <p className="text-muted-foreground">
              No hay listas de productos importadas para {supplierName}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {productLists.map((list) => {
            const isCollapsed = collapsedLists.has(list.id);
            const products = productsMap[list.id] || [];

            return (
              <Card key={list.id} className="glassmorphism border-primary/20">
                <CardHeader className="cursor-pointer" onClick={() => toggleListCollapse(list.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                      <div>
                        <CardTitle className="text-lg">{list.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {list.fileType.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(list.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {list.productCount} productos
                          </span>
                        </div>
                      </div>
                    </div>
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
                </CardHeader>
                {!isCollapsed && (
                  <CardContent>
                    <DynamicProductTable
                      listId={list.id}
                      products={products}
                      columnSchema={list.columnSchema}
                    />
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!listToDelete} onOpenChange={() => setListToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente la lista y
              todos sus productos.
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
