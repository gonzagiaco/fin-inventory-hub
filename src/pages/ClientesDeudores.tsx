import { useState, useMemo } from "react";
import Header from "@/components/Header";
import ClientDialog from "@/components/ClientDialog";
import PaymentDialog from "@/components/PaymentDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Search, Plus, Edit, Trash2, FileText, Send, DollarSign, Eye } from "lucide-react";
import { Client, StockItem, Payment } from "@/types";
import { toast } from "sonner";
import { generateInvoicePDF } from "@/utils/pdfGenerator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ClientesDeudores = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"amount" | "date">("amount");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);

  // Mock stock items for product selection
  const [stockItems] = useState<StockItem[]>([
    {
      id: "1",
      code: "FRT001",
      name: "Manzanas Rojas",
      quantity: 150,
      category: "Fruits",
      costPrice: 2.5,
      supplierId: "1",
      specialDiscount: false,
      minStockLimit: 50,
    },
    {
      id: "2",
      code: "BKR001",
      name: "Pan Integral",
      quantity: 80,
      category: "Bakery",
      costPrice: 1.2,
      supplierId: "2",
      specialDiscount: true,
      minStockLimit: 30,
    },
  ]);

  const [clients, setClients] = useState<Client[]>([
    {
      id: "1",
      name: "Ana Torres",
      amount: 500,
      amountPaid: 200,
      dueDate: "15/07/2024",
      status: "pending",
      phone: "+1234567890",
      email: "ana@example.com",
      address: "Calle Principal 123, Ciudad",
      products: [],
      payments: [
        { id: "p1", amount: 200, date: "10/07/2024", notes: "Pago inicial" }
      ],
      issueDate: "01/07/2024",
    },
    {
      id: "2",
      name: "Carlos Ruiz",
      amount: 1200,
      amountPaid: 0,
      dueDate: "20/07/2024",
      status: "pending",
      phone: "+1234567891",
      address: "Av. Libertador 456",
      products: [],
      payments: [],
      issueDate: "05/07/2024",
    },
    {
      id: "3",
      name: "Sofía López",
      amount: 300,
      amountPaid: 300,
      dueDate: "25/07/2024",
      status: "paid",
      email: "sofia@example.com",
      products: [],
      payments: [
        { id: "p2", amount: 300, date: "20/07/2024" }
      ],
      issueDate: "10/07/2024",
    },
  ]);

  // Búsqueda y ordenamiento
  const filteredAndSortedClients = useMemo(() => {
    let filtered = clients.filter((client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortBy === "amount") {
      filtered.sort((a, b) => b.amount - a.amount);
    } else {
      filtered.sort((a, b) => {
        const dateA = a.dueDate.split("/").reverse().join("");
        const dateB = b.dueDate.split("/").reverse().join("");
        return dateB.localeCompare(dateA);
      });
    }

    return filtered;
  }, [clients, searchQuery, sortBy]);

  const getStatusBadge = (status: Client["status"]) => {
    const styles = {
      pending: "bg-yellow-500/20 text-yellow-300",
      paid: "bg-green-500/20 text-green-300",
      overdue: "bg-red-500/20 text-red-300",
    };

    const labels = {
      pending: "Pendiente",
      paid: "Pagado",
      overdue: "Vencido",
    };

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  const handleSaveClient = (client: Omit<Client, "id"> & { id?: string }) => {
    if (client.id) {
      // Update existing client
      setClients((prev) =>
        prev.map((c) => {
          if (c.id === client.id) {
            // Auto-update status based on payment
            const remaining = client.amount - client.amountPaid;
            let newStatus: Client["status"] = "pending";
            
            if (remaining === 0) {
              newStatus = "paid";
            } else {
              const dueDate = new Date(client.dueDate.split("/").reverse().join("-"));
              const today = new Date();
              if (today > dueDate && remaining > 0) {
                newStatus = "overdue";
              }
            }
            
            return { ...client, id: client.id, status: newStatus };
          }
          return c;
        })
      );
      toast.success("Cliente actualizado correctamente");
    } else {
      // Create new client
      const newClient: Client = {
        ...client,
        id: Date.now().toString(),
        status: "pending",
      };
      setClients((prev) => [...prev, newClient]);
      toast.success("Factura creada correctamente");
    }
    setEditingClient(null);
  };

  const handleRegisterPayment = (client: Client) => {
    setPaymentClient(client);
    setPaymentDialogOpen(true);
  };

  const handleSavePayment = (payment: Omit<Payment, "id">) => {
    if (!paymentClient) return;

    const newPayment: Payment = {
      ...payment,
      id: Date.now().toString(),
    };

    setClients((prev) =>
      prev.map((c) => {
        if (c.id === paymentClient.id) {
          const updatedAmountPaid = c.amountPaid + payment.amount;
          const remaining = c.amount - updatedAmountPaid;
          
          let newStatus: Client["status"] = "pending";
          if (remaining === 0) {
            newStatus = "paid";
          } else {
            const dueDate = new Date(c.dueDate.split("/").reverse().join("-"));
            const today = new Date();
            if (today > dueDate && remaining > 0) {
              newStatus = "overdue";
            }
          }

          return {
            ...c,
            amountPaid: updatedAmountPaid,
            payments: [...c.payments, newPayment],
            status: newStatus,
          };
        }
        return c;
      })
    );

    toast.success("Pago registrado correctamente");
    setPaymentClient(null);
  };

  const handleGeneratePDF = (client: Client) => {
    generateInvoicePDF(client);
    toast.success("PDF generado correctamente");
  };

  const handleSendWhatsApp = (client: Client) => {
    const remaining = client.amount - client.amountPaid;
    const message = `Hola ${client.name},\n\nTe envío el resumen de tu factura:\n\n` +
      `Total: $${client.amount.toFixed(2)}\n` +
      `Pagado: $${client.amountPaid.toFixed(2)}\n` +
      `Restante: $${remaining.toFixed(2)}\n` +
      `Vencimiento: ${client.dueDate}\n\n` +
      `¡Gracias por tu compra!`;
    
    const phoneNumber = client.phone?.replace(/\D/g, "") || "";
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, "_blank");
    toast.success("Abriendo WhatsApp");
  };

  const handleDeleteClient = (id: string) => {
    setDeletingClientId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingClientId) {
      setClients((prev) => prev.filter((client) => client.id !== deletingClientId));
      toast.success("Cliente eliminado correctamente");
      setDeletingClientId(null);
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  return (
    <div className="flex-1 p-6 lg:p-10">
      <Header
        title="Clientes Deudores"
        subtitle="Gestiona los clientes con pagos pendientes."
        showSearch={false}
      />

      <main>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {filteredAndSortedClients.map((client) => {
            const remaining = client.amount - client.amountPaid;
            const paymentProgress = (client.amountPaid / client.amount) * 100;

            return (
              <Card key={client.id} className="bg-card border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-foreground">{client.name}</CardTitle>
                      <CardDescription className="text-muted-foreground mt-1">
                        {client.address && (
                          <div className="text-xs">{client.address}</div>
                        )}
                        {client.phone && (
                          <div className="text-xs mt-1">📱 {client.phone}</div>
                        )}
                      </CardDescription>
                    </div>
                    {getStatusBadge(client.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-semibold text-foreground">${client.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pagado:</span>
                      <span className="font-semibold text-green-500">${client.amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Restante:</span>
                      <span className="font-semibold text-primary">${remaining.toFixed(2)}</span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-muted/30 rounded-full h-2 mt-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${paymentProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <div>Emisión: {client.issueDate}</div>
                    <div>Vencimiento: {client.dueDate}</div>
                  </div>

                  {/* Payment history */}
                  {client.payments.length > 0 && (
                    <div className="pt-2 border-t border-primary/10">
                      <div className="text-xs font-semibold text-foreground mb-1">Historial de Pagos:</div>
                      <div className="space-y-1">
                        {client.payments.slice(-2).map((payment) => (
                          <div key={payment.id} className="text-xs text-muted-foreground flex justify-between">
                            <span>{payment.date}</span>
                            <span className="text-green-500">${payment.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClient(client)}
                      className="text-xs"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGeneratePDF(client)}
                      className="text-xs"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                    {remaining > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegisterPayment(client)}
                        className="text-xs"
                      >
                        <DollarSign className="h-3 w-3 mr-1" />
                        Pago
                      </Button>
                    )}
                    {client.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendWhatsApp(client)}
                        className="text-xs"
                      >
                        <Send className="h-3 w-3 mr-1" />
                        WhatsApp
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClient(client.id)}
                      className="text-xs col-span-2 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredAndSortedClients.length === 0 && (
          <div className="glassmorphism rounded-xl shadow-lg p-12 text-center">
            <p className="text-muted-foreground">No se encontraron clientes</p>
          </div>
        )}
      </main>

      {/* Floating Add Button */}
      <button
        onClick={() => {
          setEditingClient(null);
          setDialogOpen(true);
        }}
        className="fixed bottom-8 right-8 w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/40 hover:bg-primary/90 transition-all transform hover:scale-105"
      >
        <Plus className="h-8 w-8" />
      </button>

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editingClient}
        onSave={handleSaveClient}
        stockItems={stockItems}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        remainingAmount={paymentClient ? paymentClient.amount - paymentClient.amountPaid : 0}
        onSave={handleSavePayment}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="¿Eliminar cliente?"
        description="Esta acción no se puede deshacer. El cliente será eliminado permanentemente del sistema."
      />
    </div>
  );
};

export default ClientesDeudores;
