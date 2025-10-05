import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Supplier, StockItem, ImportRecord } from "@/types";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, Package, Calendar, Plus, Trash2 } from "lucide-react";
import StockDialog from "./StockDialog";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

interface SupplierDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  products: StockItem[];
  suppliers: Supplier[];
  onImportProducts: (products: StockItem[], supplierId: string) => void;
  onAddImportRecord: (record: ImportRecord) => void;
  importRecords: ImportRecord[];
  onAddProduct: (product: Omit<StockItem, "id"> & { id?: string }) => void;
  onDeleteProduct: (productId: string) => void;
}

const SupplierDetailDialog = ({
  open,
  onOpenChange,
  supplier,
  products,
  suppliers,
  onImportProducts,
  onAddImportRecord,
  importRecords,
  onAddProduct,
  onDeleteProduct,
}: SupplierDetailDialogProps) => {
  const [isImporting, setIsImporting] = useState(false);
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let newCount = 0;
      let updateCount = 0;
      const importedProducts: StockItem[] = [];

      jsonData.forEach((row: any) => {
        const code = String(row.code || row.Code || row.codigo || row.Codigo || "").trim();
        const name = String(row.name || row.Name || row.description || row.Description || row.descripcion || row.Descripcion || "").trim();
        const costPrice = Number(row.price || row.Price || row.precio || row.Precio || 0);

        if (code && name && costPrice > 0) {
          const existingProduct = products.find((p) => p.code === code);
          
          if (existingProduct) {
            updateCount++;
            importedProducts.push({
              ...existingProduct,
              name,
              costPrice,
              supplierId: supplier.id,
            });
          } else {
            newCount++;
            importedProducts.push({
              id: crypto.randomUUID(),
              code,
              name,
              quantity: 0,
              category: "Produce",
              costPrice,
              supplierId: supplier.id,
              specialDiscount: false,
              minStockLimit: 10,
            });
          }
        }
      });

      if (importedProducts.length === 0) {
        toast({
          title: "Error en importación",
          description: "No se encontraron productos válidos en el archivo. Asegúrate de que tenga columnas: code, name/description, price.",
          variant: "destructive",
        });
        return;
      }

      onImportProducts(importedProducts, supplier.id);

      const importRecord: ImportRecord = {
        id: crypto.randomUUID(),
        supplierId: supplier.id,
        fileName: file.name,
        date: new Date().toISOString(),
        newProducts: newCount,
        updatedProducts: updateCount,
      };
      onAddImportRecord(importRecord);

      toast({
        title: "Importación exitosa",
        description: `${newCount} productos nuevos agregados, ${updateCount} productos actualizados.`,
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error importing file:", error);
      toast({
        title: "Error",
        description: "No se pudo procesar el archivo Excel.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteClick = (productId: string) => {
    setProductToDelete(productId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (productToDelete) {
      onDeleteProduct(productToDelete);
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado correctamente.",
      });
      setProductToDelete(null);
    }
  };

  const supplierImports = importRecords.filter((r) => r.supplierId === supplier.id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-primary/20 max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-3">
              {supplier.logo && (
                <img
                  src={supplier.logo}
                  alt={supplier.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              )}
              {supplier.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Import Section */}
            <div className="glassmorphism rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importar Productos desde Excel
              </h3>
              <p className="text-sm text-muted-foreground">
                El archivo debe contener columnas: <strong>code</strong>, <strong>name/description</strong>, y <strong>price</strong>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full"
              >
                {isImporting ? "Importando..." : "Seleccionar Archivo Excel"}
              </Button>
            </div>

            {/* Import History */}
            {supplierImports.length > 0 && (
              <div className="glassmorphism rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Historial de Importaciones
                </h3>
                <div className="space-y-2">
                  {supplierImports.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {record.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(record.date).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{record.newProducts} nuevos</p>
                        <p>{record.updatedProducts} actualizados</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Products List */}
            <div className="glassmorphism rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Productos ({products.length})
                </h3>
                <Button
                  onClick={() => setIsAddProductDialogOpen(true)}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Producto
                </Button>
              </div>
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay productos de este proveedor
                </p>
              ) : (
                <div className="border border-primary/20 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Precio Costo</TableHead>
                        <TableHead>Precio Público</TableHead>
                        <TableHead className="text-center">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => {
                        const publicPrice = product.specialDiscount
                          ? product.costPrice * 0.92 * 2
                          : product.costPrice * 2;
                        
                        return (
                          <TableRow key={product.id}>
                            <TableCell className="font-mono">{product.code}</TableCell>
                            <TableCell>{product.name}</TableCell>
                            <TableCell>{product.quantity}</TableCell>
                            <TableCell>${product.costPrice.toFixed(2)}</TableCell>
                            <TableCell>${publicPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(product.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <StockDialog
        open={isAddProductDialogOpen}
        onOpenChange={setIsAddProductDialogOpen}
        onSave={(product) => {
          onAddProduct({ ...product, supplierId: supplier.id });
          setIsAddProductDialogOpen(false);
        }}
        suppliers={suppliers}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="¿Eliminar producto?"
        description="Esta acción no se puede deshacer. El producto será eliminado permanentemente."
      />
    </>
  );
};

export default SupplierDetailDialog;
