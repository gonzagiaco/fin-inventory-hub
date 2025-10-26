import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeliveryNote, CreateDeliveryNoteInput, UpdateDeliveryNoteInput } from "@/types";
import { toast } from "sonner";

export const useDeliveryNotes = () => {
  const queryClient = useQueryClient();

  const { data: deliveryNotes = [], isLoading } = useQuery({
    queryKey: ["delivery-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_notes")
        .select(`
          *,
          items:delivery_note_items(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map(note => ({
        id: note.id,
        userId: note.user_id,
        customerName: note.customer_name,
        customerAddress: note.customer_address,
        customerPhone: note.customer_phone,
        issueDate: note.issue_date,
        totalAmount: Number(note.total_amount),
        paidAmount: Number(note.paid_amount),
        remainingBalance: Number(note.remaining_balance),
        status: note.status as 'pending' | 'paid',
        extraFields: note.extra_fields,
        notes: note.notes,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
        items: note.items.map((item: any) => ({
          id: item.id,
          deliveryNoteId: item.delivery_note_id,
          productId: item.product_id,
          productCode: item.product_code,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          subtotal: Number(item.subtotal),
          createdAt: item.created_at,
        })),
      })) as DeliveryNote[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateDeliveryNoteInput) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No autenticado");

      const total = input.items.reduce((sum, item) => 
        sum + (item.quantity * item.unitPrice), 0
      );

      const status = (input.paidAmount || 0) >= total ? 'paid' : 'pending';

      const { data: note, error: noteError } = await supabase
        .from("delivery_notes")
        .insert({
          user_id: user.user.id,
          customer_name: input.customerName,
          customer_address: input.customerAddress,
          customer_phone: input.customerPhone,
          issue_date: input.issueDate || new Date().toISOString(),
          total_amount: total,
          paid_amount: input.paidAmount || 0,
          extra_fields: input.extraFields,
          notes: input.notes,
          status,
        })
        .select()
        .single();

      if (noteError) throw noteError;

      const { error: itemsError } = await supabase
        .from("delivery_note_items")
        .insert(
          input.items.map(item => ({
            delivery_note_id: note.id,
            product_id: item.productId,
            product_code: item.productCode,
            product_name: item.productName,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          }))
        );

      if (itemsError) throw itemsError;

      for (const item of input.items) {
        if (item.productId) {
          const { data: dynamicProduct } = await supabase
            .from("dynamic_products")
            .select("quantity")
            .eq("id", item.productId)
            .maybeSingle();

          if (dynamicProduct) {
            const { error: stockError } = await supabase
              .from("dynamic_products")
              .update({ 
                quantity: (dynamicProduct.quantity || 0) - item.quantity 
              })
              .eq("id", item.productId);

            if (stockError) throw stockError;
          } else {
            const { data: stockItem } = await supabase
              .from("stock_items")
              .select("quantity")
              .eq("id", item.productId)
              .maybeSingle();

            if (stockItem) {
              const { error: stockError } = await supabase
                .from("stock_items")
                .update({ 
                  quantity: (stockItem.quantity || 0) - item.quantity 
                })
                .eq("id", item.productId);

              if (stockError) throw stockError;
            }
          }
        }
      }

      return note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-products"] });
      toast.success("Remito creado exitosamente y stock actualizado");
    },
    onError: (error: any) => {
      toast.error(`Error al crear remito: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateDeliveryNoteInput) => {
      const { data: originalNote, error: fetchError } = await supabase
        .from("delivery_notes")
        .select(`*, items:delivery_note_items(*)`)
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      let newTotal = originalNote.total_amount;
      if (updates.items) {
        newTotal = updates.items.reduce((sum, item) => 
          sum + (item.quantity * item.unitPrice), 0
        );
      }

      const paidAmount = updates.paidAmount ?? originalNote.paid_amount;
      const status = paidAmount >= newTotal ? 'paid' : 'pending';

      const { error: updateError } = await supabase
        .from("delivery_notes")
        .update({
          customer_name: updates.customerName,
          customer_address: updates.customerAddress,
          customer_phone: updates.customerPhone,
          issue_date: updates.issueDate,
          total_amount: newTotal,
          paid_amount: paidAmount,
          extra_fields: updates.extraFields,
          notes: updates.notes,
          status,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      if (updates.items) {
        for (const item of originalNote.items) {
          if (item.product_id) {
            const { data: dynamicProduct } = await supabase
              .from("dynamic_products")
              .select("quantity")
              .eq("id", item.product_id)
              .maybeSingle();

            if (dynamicProduct) {
              await supabase
                .from("dynamic_products")
                .update({ 
                  quantity: (dynamicProduct.quantity || 0) + item.quantity 
                })
                .eq("id", item.product_id);
            } else {
              const { data: stockItem } = await supabase
                .from("stock_items")
                .select("quantity")
                .eq("id", item.product_id)
                .maybeSingle();

              if (stockItem) {
                await supabase
                  .from("stock_items")
                  .update({ 
                    quantity: (stockItem.quantity || 0) + item.quantity 
                  })
                  .eq("id", item.product_id);
              }
            }
          }
        }

        await supabase
          .from("delivery_note_items")
          .delete()
          .eq("delivery_note_id", id);

        await supabase
          .from("delivery_note_items")
          .insert(
            updates.items.map(item => ({
              delivery_note_id: id,
              product_id: item.productId,
              product_code: item.productCode,
              product_name: item.productName,
              quantity: item.quantity,
              unit_price: item.unitPrice,
            }))
          );

        for (const item of updates.items) {
          if (item.productId) {
            const { data: dynamicProduct } = await supabase
              .from("dynamic_products")
              .select("quantity")
              .eq("id", item.productId)
              .maybeSingle();

            if (dynamicProduct) {
              await supabase
                .from("dynamic_products")
                .update({ 
                  quantity: (dynamicProduct.quantity || 0) - item.quantity 
                })
                .eq("id", item.productId);
            } else {
              const { data: stockItem } = await supabase
                .from("stock_items")
                .select("quantity")
                .eq("id", item.productId)
                .maybeSingle();

              if (stockItem) {
                await supabase
                  .from("stock_items")
                  .update({ 
                    quantity: (stockItem.quantity || 0) - item.quantity 
                  })
                  .eq("id", item.productId);
              }
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-products"] });
      toast.success("Remito actualizado exitosamente");
    },
    onError: (error: any) => {
      toast.error(`Error al actualizar remito: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: note, error: fetchError } = await supabase
        .from("delivery_notes")
        .select(`*, items:delivery_note_items(*)`)
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      for (const item of note.items) {
        if (item.product_id) {
          const { data: dynamicProduct } = await supabase
            .from("dynamic_products")
            .select("quantity")
            .eq("id", item.product_id)
            .maybeSingle();

          if (dynamicProduct) {
            await supabase
              .from("dynamic_products")
              .update({ 
                quantity: (dynamicProduct.quantity || 0) + item.quantity 
              })
              .eq("id", item.product_id);
          } else {
            const { data: stockItem } = await supabase
              .from("stock_items")
              .select("quantity")
              .eq("id", item.product_id)
              .maybeSingle();

            if (stockItem) {
              await supabase
                .from("stock_items")
                .update({ 
                  quantity: (stockItem.quantity || 0) + item.quantity 
                })
                .eq("id", item.product_id);
            }
          }
        }
      }

      const { error: deleteError } = await supabase
        .from("delivery_notes")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-products"] });
      toast.success("Remito eliminado y stock revertido");
    },
    onError: (error: any) => {
      toast.error(`Error al eliminar remito: ${error.message}`);
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: note } = await supabase
        .from("delivery_notes")
        .select("total_amount")
        .eq("id", id)
        .single();

      if (!note) throw new Error("Remito no encontrado");

      const { error } = await supabase
        .from("delivery_notes")
        .update({
          paid_amount: note.total_amount,
          status: 'paid',
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      toast.success("Remito marcado como pagado");
    },
  });

  return {
    deliveryNotes,
    isLoading,
    createDeliveryNote: createMutation.mutateAsync,
    updateDeliveryNote: updateMutation.mutateAsync,
    deleteDeliveryNote: deleteMutation.mutateAsync,
    markAsPaid: markAsPaidMutation.mutateAsync,
  };
};
