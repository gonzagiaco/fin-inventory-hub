import { useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Supplier, StockItem, ImportRecord } from "@/types";
import SupplierDialog from "@/components/SupplierDialog";
import SupplierDetailDialog from "@/components/SupplierDetailDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

const Proveedores = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([
    {
      id: "1",
      name: "Fresh Farms",
      logo: "https://images.unsplash.com/photo-1560493676-04071c5f467b?w=200&h=200&fit=crop",
    },
    {
      id: "2",
      name: "Bakery Co",
      logo: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=200&h=200&fit=crop",
    },
    {
      id: "3",
      name: "Dairy Express",
      logo: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&h=200&fit=crop",
    },
    {
      id: "4",
      name: "Farm Direct",
      logo: "",
    },
    {
      id: "5",
      name: "Tropical Imports",
      logo: "",
    },
  ]);

  const [stockItems, setStockItems] = useState<StockItem[]>([
    {
      id: "1",
      code: "PROD001",
      name: "Fresh Apples",
      quantity: 150,
      category: "Fruits",
      costPrice: 1.5,
      supplierId: "1",
      specialDiscount: true,
      minStockLimit: 50,
    },
    {
      id: "2",
      code: "PROD002",
      name: "Organic Milk",
      quantity: 80,
      category: "Dairy",
      costPrice: 2.0,
      supplierId: "3",
      specialDiscount: false,
      minStockLimit: 30,
    },
  ]);

  const [importRecords, setImportRecords] = useState<ImportRecord[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const handleCreateSupplier = () => {
    setSelectedSupplier(null);
    setIsDialogOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (supplierToDelete) {
      setSuppliers(suppliers.filter((s) => s.id !== supplierToDelete.id));
      setStockItems(stockItems.filter((item) => item.supplierId !== supplierToDelete.id));
      toast({
        title: "Proveedor eliminado",
        description: `${supplierToDelete.name} y sus productos han sido eliminados.`,
      });
      setSupplierToDelete(null);
    }
  };

  const handleSaveSupplier = (supplier: Supplier) => {
    if (selectedSupplier) {
      setSuppliers(
        suppliers.map((s) => (s.id === supplier.id ? supplier : s))
      );
    } else {
      setSuppliers([...suppliers, supplier]);
    }
  };

  const handleViewDetails = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDetailDialogOpen(true);
  };

  const handleImportProducts = (products: StockItem[], supplierId: string) => {
    const updatedItems = [...stockItems];
    
    products.forEach((importedProduct) => {
      const existingIndex = updatedItems.findIndex(
        (item) => item.code === importedProduct.code
      );
      
      if (existingIndex !== -1) {
        updatedItems[existingIndex] = importedProduct;
      } else {
        updatedItems.push(importedProduct);
      }
    });

    setStockItems(updatedItems);
  };

  const handleAddImportRecord = (record: ImportRecord) => {
    setImportRecords([record, ...importRecords]);
  };

  const handleAddProduct = (product: Omit<StockItem, "id"> & { id?: string }) => {
    if (product.id) {
      setStockItems((prev) =>
        prev.map((item) => (item.id === product.id ? { ...product, id: product.id } : item))
      );
      toast({
        title: "Producto actualizado",
        description: "El producto ha sido actualizado correctamente.",
      });
    } else {
      const newProduct: StockItem = {
        ...product,
        id: crypto.randomUUID(),
      };
      setStockItems((prev) => [...prev, newProduct]);
      toast({
        title: "Producto agregado",
        description: "El producto ha sido agregado correctamente.",
      });
    }
  };

  const handleDeleteProduct = (productId: string) => {
    setStockItems((prev) => prev.filter((item) => item.id !== productId));
  };

  return (
    <div className="flex-1 p-6 lg:p-10">
      <Header
        title="Proveedores"
        subtitle="Gestiona tus proveedores y sus productos."
        showSearch={false}
      />
      
      <div className="mb-6 flex justify-end">
        <Button onClick={handleCreateSupplier} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Proveedor
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <div className="glassmorphism rounded-xl shadow-lg p-12 text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            No hay proveedores
          </h2>
          <p className="text-muted-foreground mb-6">
            Comienza agregando tu primer proveedor
          </p>
          <Button onClick={handleCreateSupplier} className="gap-2">
            <Plus className="w-4 h-4" />
            Agregar Proveedor
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((supplier) => {
            const supplierProducts = stockItems.filter(
              (item) => item.supplierId === supplier.id
            );

            return (
              <Card
                key={supplier.id}
                className="glassmorphism border-primary/20 hover:border-primary/40 transition-all cursor-pointer"
                onClick={() => handleViewDetails(supplier)}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    {supplier.logo ? (
                      <img
                        src={supplier.logo}
                        alt={supplier.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-primary" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        {supplier.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {supplierProducts.length} productos
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditSupplier(supplier);
                    }}
                    className="flex-1 gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(supplier);
                    }}
                    className="flex-1 gap-2 border-red-500/20 text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <SupplierDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSaveSupplier}
        supplier={selectedSupplier}
      />

      {selectedSupplier && (
        <SupplierDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          supplier={selectedSupplier}
          products={stockItems.filter(
            (item) => item.supplierId === selectedSupplier.id
          )}
          suppliers={suppliers}
          onImportProducts={handleImportProducts}
          onAddImportRecord={handleAddImportRecord}
          importRecords={importRecords}
          onAddProduct={handleAddProduct}
          onDeleteProduct={handleDeleteProduct}
        />
      )}

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="¿Eliminar proveedor?"
        description={`¿Estás seguro de que deseas eliminar a ${supplierToDelete?.name}? Esto también eliminará todos los productos asociados.`}
      />
    </div>
  );
};

export default Proveedores;
