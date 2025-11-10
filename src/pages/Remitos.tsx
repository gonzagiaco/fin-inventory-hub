import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDeliveryNotes } from "@/hooks/useDeliveryNotes";
import DeliveryNoteDialog from "@/components/DeliveryNoteDialog";
import { generateDeliveryNotePDF } from "@/utils/deliveryNotePdfGenerator";
import { Plus, Download, MessageCircle, Trash2, CheckCircle, Edit } from "lucide-react";
import { format } from "date-fns";
import { DeliveryNote } from "@/types";
import Header from "@/components/Header";

const Remitos = () => {
  const { deliveryNotes, isLoading, deleteDeliveryNote, markAsPaid } = useDeliveryNotes();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DeliveryNote | undefined>();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredNotes = deliveryNotes.filter(note => {
    const matchesSearch = note.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || note.status === statusFilter;
    
    let matchesDate = true;
    if (dateFrom) {
      matchesDate = matchesDate && new Date(note.issueDate) >= new Date(dateFrom);
    }
    if (dateTo) {
      matchesDate = matchesDate && new Date(note.issueDate) <= new Date(dateTo);
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleExportPDF = (note: DeliveryNote) => {
    generateDeliveryNotePDF(note);
  };

  const handleWhatsApp = (note: DeliveryNote) => {
    const pdfUrl = generateDeliveryNotePDF(note);
    const message = encodeURIComponent(
      `Hola ${note.customerName}, te envío tu remito #${note.id.substring(0, 8)}.\n\n` +
      `Total: $${note.totalAmount.toFixed(2)}\n` +
      `Pagado: $${note.paidAmount.toFixed(2)}\n` +
      `Restante: $${note.remainingBalance.toFixed(2)}\n\n` +
      `Link al PDF: ${pdfUrl}`
    );
    
    const phone = note.customerPhone?.replace(/[^0-9]/g, "");
    const whatsappUrl = phone 
      ? `https://wa.me/${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    
    window.open(whatsappUrl, "_blank");
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro? Se revertirá el stock.")) {
      await deleteDeliveryNote(id);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    await markAsPaid(id);
  };

  return (
    <div className="flex-1 overflow-auto" style={{ paddingTop: 'max(env(safe-area-inset-top), 1.5rem)' }}>
      <div className="pl-16 lg:pl-0">
        <Header 
          title="Remitos de Venta"
          subtitle="Gestiona remitos, descuenta stock automáticamente y comunica con clientes"
        />
      </div>
      
      <div className="p-8 pl-16 lg:pl-8 space-y-6">
        <div className="flex justify-between items-center">
          <Button onClick={() => { setEditingNote(undefined); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Remito
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Buscar por cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="paid">Pagados</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Desde"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              type="date"
              placeholder="Hasta"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </CardContent>
        </Card>

        {isLoading ? (
          <p>Cargando remitos...</p>
        ) : filteredNotes.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No se encontraron remitos.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredNotes.map((note) => (
              <Card key={note.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{note.customerName}</h3>
                        <Badge variant={note.status === 'paid' ? 'default' : 'secondary'}>
                          {note.status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Fecha: {format(new Date(note.issueDate), "dd/MM/yyyy")}
                      </p>
                      {note.customerAddress && (
                        <p className="text-sm">{note.customerAddress}</p>
                      )}
                      {note.customerPhone && (
                        <p className="text-sm">Tel: {note.customerPhone}</p>
                      )}
                      <div className="flex gap-4 text-sm mt-2">
                        <span>Total: <strong>${note.totalAmount.toFixed(2)}</strong></span>
                        <span>Pagado: <strong>${note.paidAmount.toFixed(2)}</strong></span>
                        <span>Restante: <strong>${note.remainingBalance.toFixed(2)}</strong></span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {note.items?.length || 0} producto(s)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditingNote(note); setIsDialogOpen(true); }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportPDF(note)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWhatsApp(note)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      {note.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkAsPaid(note.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(note.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <DeliveryNoteDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          note={editingNote}
        />
      </div>
    </div>
  );
};

export default Remitos;
