import { useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Supplier } from "@/types";
import SupplierDialog from "@/components/SupplierDialog";
import SupplierDetailDialog from "@/components/SupplierDetailDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useProductListsIndex } from "@/hooks/useProductListsIndex";

const Proveedores = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Use Supabase hooks for data
  const { suppliers, isLoading: isLoadingSuppliers, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const { data: lists = [] } = useProductListsIndex();

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
      deleteSupplier(supplierToDelete.id);
      setSupplierToDelete(null);
    }
  };

  const handleSaveSupplier = async (supplier: Omit<Supplier, "id"> & { id?: string }) => {
    try {
      if (supplier.id) {
        // Edit existing
        await updateSupplier({ id: supplier.id, name: supplier.name, logo: supplier.logo });
      } else {
        // Create new
        await createSupplier({ name: supplier.name, logo: supplier.logo });
      }
      setIsDialogOpen(false);
      setSelectedSupplier(null);
    } catch (error) {
      // Error handling is done in the hooks with toast
      console.error("Error saving supplier:", error);
    }
  };

  const handleViewDetails = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDetailDialogOpen(true);
  };

  const getProductCount = (supplierId: string) => {
    return lists
      .filter((list: any) => list.supplier_id === supplierId)
      .reduce((sum, list: any) => sum + (list.product_count || 0), 0);
  };
  return (
    <div className="flex-1 p-6 lg:p-10 w-full max-w-full overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top), 1.5rem)', paddingLeft: 'max(4rem, 1.5rem)' }}>
      <Header title="Proveedores" subtitle="Gestiona tus proveedores y sus productos." showSearch={false} />

      <div className="mb-6 flex justify-end">
        <Button onClick={handleCreateSupplier} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Proveedor
        </Button>
      </div>

      {isLoadingSuppliers ? (
        <div className="glassmorphism rounded-xl shadow-lg p-12 text-center space-y-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <p className="text-muted-foreground">Cargando proveedores...</p>
          <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos para listas grandes</p>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="glassmorphism rounded-xl shadow-lg p-12 text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground mb-2">No hay proveedores</h2>
          <p className="text-muted-foreground mb-6">Comienza agregando tu primer proveedor</p>
          <Button onClick={handleCreateSupplier} className="gap-2">
            <Plus className="w-4 h-4" />
            Agregar Proveedor
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((supplier) => {
            const productCount = getProductCount(supplier.id);

            return (
              <Card
                key={supplier.id}
                className="glassmorphism border-primary/20 hover:border-primary/40 transition-all cursor-pointer"
                onClick={() => handleViewDetails(supplier)}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    {supplier.logo ? (
                      <img src={supplier.logo} alt={supplier.name} className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-primary" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">{supplier.name}</h3>
                      <p className="text-sm text-muted-foreground">{productCount} productos</p>
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
