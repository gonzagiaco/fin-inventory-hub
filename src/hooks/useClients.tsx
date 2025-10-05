import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Client, InvoiceProduct, Payment } from "@/types";

interface ClientWithDetails extends Omit<Client, 'id'> {
  id: string;
}

export const useClients = () => {
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients-with-invoices"],
    queryFn: async () => {
      // Fetch clients with their invoices, products, and payments
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      const clientsWithDetails = await Promise.all(
        clientsData.map(async (client) => {
          // Get invoices for this client
          const { data: invoices, error: invoicesError } = await supabase
            .from("invoices")
            .select("*")
            .eq("client_id", client.id);

          if (invoicesError) throw invoicesError;

          if (!invoices || invoices.length === 0) {
            return null;
          }

          // For simplicity, take the first invoice (or you could aggregate all)
          const invoice = invoices[0];

          // Get products for this invoice
          const { data: products, error: productsError } = await supabase
            .from("invoice_products")
            .select("*")
            .eq("invoice_id", invoice.id);

          if (productsError) throw productsError;

          // Get payments for this invoice
          const { data: payments, error: paymentsError } = await supabase
            .from("payments")
            .select("*")
            .eq("invoice_id", invoice.id)
            .order("payment_date", { ascending: false });

          if (paymentsError) throw paymentsError;

          return {
            id: client.id,
            name: client.name,
            phone: client.phone || "",
            email: client.email || "",
            address: client.address || "",
            amount: Number(invoice.total_amount),
            amountPaid: Number(invoice.amount_paid),
            status: invoice.status as "pending" | "paid" | "overdue",
            dueDate: invoice.due_date,
            issueDate: invoice.issue_date,
            products: (products || []).map((p) => ({
              code: p.product_code,
              name: p.product_name,
              costPrice: Number(p.cost_price),
              salePrice: Number(p.sale_price),
              quantity: p.quantity,
              subtotal: Number(p.subtotal),
            })),
            payments: (payments || []).map((p) => ({
              id: p.id,
              amount: Number(p.amount),
              date: p.payment_date,
              notes: p.notes || "",
            })),
          } as ClientWithDetails;
        })
      );

      return clientsWithDetails.filter((c) => c !== null) as ClientWithDetails[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (client: Omit<Client, "id">) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Create client
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .insert([{
          user_id: userData.user?.id,
          name: client.name,
          phone: client.phone,
          email: client.email,
          address: client.address,
        }])
        .select()
        .single();

      if (clientError) throw clientError;

      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert([{
          user_id: userData.user?.id,
          client_id: clientData.id,
          total_amount: client.amount,
          amount_paid: client.amountPaid,
          status: client.status,
          issue_date: client.issueDate,
          due_date: client.dueDate,
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice products
      if (client.products && client.products.length > 0) {
        const { error: productsError } = await supabase
          .from("invoice_products")
          .insert(
            client.products.map((p) => ({
              invoice_id: invoiceData.id,
              product_code: p.code,
              product_name: p.name,
              cost_price: p.costPrice,
              sale_price: p.salePrice,
              quantity: p.quantity,
              subtotal: p.subtotal,
            }))
          );

        if (productsError) throw productsError;
      }

      return clientData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients-with-invoices"] });
      toast.success("Cliente agregado exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al agregar cliente");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (client: Client) => {
      // Update client
      const { error: clientError } = await supabase
        .from("clients")
        .update({
          name: client.name,
          phone: client.phone,
          email: client.email,
          address: client.address,
        })
        .eq("id", client.id);

      if (clientError) throw clientError;

      // Get invoice for this client
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("id")
        .eq("client_id", client.id)
        .limit(1);

      if (invoicesError) throw invoicesError;

      if (invoices && invoices.length > 0) {
        const invoiceId = invoices[0].id;

        // Update invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            total_amount: client.amount,
            amount_paid: client.amountPaid,
            status: client.status,
            due_date: client.dueDate,
            issue_date: client.issueDate,
          })
          .eq("id", invoiceId);

        if (invoiceError) throw invoiceError;

        // Delete old products
        await supabase.from("invoice_products").delete().eq("invoice_id", invoiceId);

        // Insert new products
        if (client.products && client.products.length > 0) {
          const { error: productsError } = await supabase
            .from("invoice_products")
            .insert(
              client.products.map((p) => ({
                invoice_id: invoiceId,
                product_code: p.code,
                product_name: p.name,
                cost_price: p.costPrice,
                sale_price: p.salePrice,
                quantity: p.quantity,
                subtotal: p.subtotal,
              }))
            );

          if (productsError) throw productsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients-with-invoices"] });
      toast.success("Cliente actualizado exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar cliente");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients-with-invoices"] });
      toast.success("Cliente eliminado exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar cliente");
    },
  });

  const registerPaymentMutation = useMutation({
    mutationFn: async ({ clientId, payment }: { clientId: string; payment: Omit<Payment, "id"> }) => {
      // Get invoice for this client
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, amount_paid")
        .eq("client_id", clientId)
        .limit(1);

      if (invoicesError) throw invoicesError;

      if (!invoices || invoices.length === 0) {
        throw new Error("No se encontró factura para este cliente");
      }

      const invoice = invoices[0];

      // Insert payment
      const { error: paymentError } = await supabase
        .from("payments")
        .insert([{
          invoice_id: invoice.id,
          amount: payment.amount,
          payment_date: payment.date,
          notes: payment.notes,
        }]);

      if (paymentError) throw paymentError;

      // Update invoice amount_paid
      const newAmountPaid = Number(invoice.amount_paid) + payment.amount;
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ amount_paid: newAmountPaid })
        .eq("id", invoice.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients-with-invoices"] });
      toast.success("Pago registrado exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar pago");
    },
  });

  return {
    clients,
    isLoading,
    createClient: createMutation.mutate,
    updateClient: updateMutation.mutate,
    deleteClient: deleteMutation.mutate,
    registerPayment: registerPaymentMutation.mutate,
  };
};