import { useState } from "react";
import Header from "@/components/Header";
import { Search, Plus } from "lucide-react";

interface Client {
  name: string;
  amount: string;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
}

const ClientesDeudores = () => {
  const [clients] = useState<Client[]>([
    { name: "Ana Torres", amount: "$500.00", dueDate: "15/07/2024", status: "pending" },
    { name: "Carlos Ruiz", amount: "$1,200.00", dueDate: "20/07/2024", status: "pending" },
    { name: "Sofía López", amount: "$300.00", dueDate: "25/07/2024", status: "paid" },
    { name: "Javier García", amount: "$800.00", dueDate: "30/07/2024", status: "overdue" },
    { name: "Elena Martínez", amount: "$650.00", dueDate: "05/08/2024", status: "pending" },
  ]);

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
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                <span>Ordenar por Monto</span>
              </button>
              <button className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
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
                {clients.map((client, index) => (
                  <tr key={index} className="hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-foreground">{client.name}</td>
                    <td className="p-4 text-muted-foreground">{client.amount}</td>
                    <td className="p-4 text-muted-foreground">{client.dueDate}</td>
                    <td className="p-4">{getStatusBadge(client.status)}</td>
                    <td className="p-4 text-primary font-medium cursor-pointer hover:underline">
                      Ver
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Floating Add Button */}
      <button className="fixed bottom-8 right-8 w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/40 hover:bg-primary/90 transition-all transform hover:scale-105">
        <Plus className="h-8 w-8" />
      </button>
    </div>
  );
};

export default ClientesDeudores;
