import { useState, useMemo } from "react";
import Header from "@/components/Header";
import ClientDialog from "@/components/ClientDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { Client } from "@/types";
import { toast } from "sonner";

const ClientesDeudores = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"amount" | "date">("amount");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([
    {
      id: "1",
      name: "Ana Torres",
      amount: 500,
      dueDate: "15/07/2024",
      status: "pending",
      phone: "+1234567890",
      email: "ana@example.com",
    },
    {
      id: "2",
      name: "Carlos Ruiz",
      amount: 1200,
      dueDate: "20/07/2024",
      status: "pending",
      phone: "+1234567891",
    },
    {
      id: "3",
      name: "Sofía López",
      amount: 300,
      dueDate: "25/07/2024",
      status: "paid",
      email: "sofia@example.com",
    },
    {
      id: "4",
      name: "Javier García",
      amount: 800,
      dueDate: "30/07/2024",
      status: "overdue",
      phone: "+1234567892",
    },
    {
      id: "5",
      name: "Elena Martínez",
      amount: 650,
      dueDate: "05/08/2024",
      status: "pending",
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
      // Editar
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...client, id: client.id } : c))
      );
      toast.success("Cliente actualizado correctamente");
    } else {
      // Crear
      const newClient: Client = {
        ...client,
        id: Date.now().toString(),
      };
      setClients((prev) => [...prev, newClient]);
      toast.success("Cliente creado correctamente");
    }
    setEditingClient(null);
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
        <div className="glassmorphism rounded-xl shadow-lg p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-white/10 bg-muted/50 focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                placeholder="Buscar clientes..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortBy("amount")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === "amount"
                    ? "bg-primary/20 text-primary"
                    : "bg-primary/10 hover:bg-primary/20 text-primary"
                }`}
              >
                <span>Ordenar por Monto</span>
              </button>
              <button
                onClick={() => setSortBy("date")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === "date"
                    ? "bg-primary/20 text-primary"
                    : "bg-primary/10 hover:bg-primary/20 text-primary"
                }`}
              >
                <span>Ordenar por Fecha</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-4 text-sm font-bold text-muted-foreground">
                    Nombre del Cliente
                  </th>
                  <th className="p-4 text-sm font-bold text-muted-foreground">Monto Adeudado</th>
                  <th className="p-4 text-sm font-bold text-muted-foreground">
                    Fecha de Vencimiento
                  </th>
                  <th className="p-4 text-sm font-bold text-muted-foreground">Estado</th>
                  <th className="p-4 text-sm font-bold text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredAndSortedClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No se encontraron clientes
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedClients.map((client) => (
                    <tr key={client.id} className="hover:bg-primary/5 transition-colors">
                      <td className="p-4 text-foreground">{client.name}</td>
                      <td className="p-4 text-muted-foreground">${client.amount.toFixed(2)}</td>
                      <td className="p-4 text-muted-foreground">{client.dueDate}</td>
                      <td className="p-4">{getStatusBadge(client.status)}</td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditClient(client)}
                            className="p-2 rounded-full hover:bg-primary/20 transition-colors duration-300 text-primary"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="p-2 rounded-full hover:bg-red-500/20 transition-colors duration-300 text-red-500"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
