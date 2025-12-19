import { useQuery, useMutation, useQueryClient, QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeliveryNote, CreateDeliveryNoteInput, UpdateDeliveryNoteInput } from "@/types";
import { toast } from "sonner";
import { useOnlineStatus } from './useOnlineStatus';
import {
  createDeliveryNoteOffline,
  updateDeliveryNoteOffline,
  deleteDeliveryNoteOffline,
  markDeliveryNoteAsPaidOffline,
  getOfflineData,
  syncDeliveryNoteById
} from '@/lib/localDB';

/**
 * Actualiza el stock de un producto
 * @param productId - ID del producto
 * @param quantityDelta - Delta de cantidad (positivo = aumentar, negativo = disminuir)
 * @param queryClient - QueryClient para invalidar cache
 */
async function updateProductStock(productId: string, quantityDelta: number, queryClient: QueryClient) {
  console.log(`📦 Actualizando stock: productId=${productId}, delta=${quantityDelta}`);

  const { data: indexProduct, error: fetchError } = await (supabase as any)
    .from("dynamic_products_index")
    .select("quantity, list_id")
    .eq("product_id", productId)
    .maybeSingle();
  
  if (fetchError) {
    console.error("❌ Error al obtener producto del índice:", fetchError);
    throw fetchError;
  }
  
  if (!indexProduct) {
    console.warn(`⚠️ Producto ${productId} no encontrado en índice`);
    return;
  }
  
  const currentQuantity = indexProduct.quantity || 0;
  const newQuantity = Math.max(0, currentQuantity + quantityDelta);

  console.log(`  Cantidad actual: ${currentQuantity}`);
  console.log(`  Delta: ${quantityDelta}`);
  console.log(`  Nueva cantidad: ${newQuantity}`);
  
  const { error: updateIndexError } = await (supabase as any)
    .from("dynamic_products_index")
    .update({ quantity: newQuantity })
    .eq("product_id", productId);
  
  if (updateIndexError) {
    console.error("❌ Error al actualizar índice:", updateIndexError);
    throw updateIndexError;
  }

  const { error: updateProductError } = await supabase
    .from("dynamic_products")
    .update({ quantity: newQuantity })
    .eq("id", productId);
  
  if (updateProductError) {
    console.error("❌ Error al actualizar producto:", updateProductError);
    throw updateProductError;
  }

  console.log(`✅ Stock actualizado correctamente: ${productId} -> ${newQuantity}`);
  
  queryClient.invalidateQueries({ queryKey: ['list-products', indexProduct.list_id] });
  queryClient.invalidateQueries({ queryKey: ['global-search'] });
}

/**
 * Invalida todas las queries relacionadas con productos
 */
function invalidateProductQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
  queryClient.invalidateQueries({ queryKey: ["my-stock"], refetchType: "all" });
  queryClient.invalidateQueries({ queryKey: ["list-products"], refetchType: "all" });
  queryClient.invalidateQueries({ queryKey: ["global-search"], refetchType: "all" });
  queryClient.invalidateQueries({ queryKey: ["product-lists-index"], refetchType: "all" });
  queryClient.invalidateQueries({ queryKey: ["product-lists"], refetchType: "all" });
  queryClient.invalidateQueries({ queryKey: ["dynamic-products"], refetchType: "all" });
  
  // Forzar refetch inmediato
  queryClient.refetchQueries({ 
    queryKey: ["list-products"], 
    type: "active" 
  });
  queryClient.refetchQueries({ 
    queryKey: ["my-stock"], 
    type: "active" 
  });
}

export const useDeliveryNotes = () => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const { data: deliveryNotes = [], isLoading } = useQuery({
    queryKey: ["delivery-notes"],
    queryFn: async () => {
      if (!isOnline) {
        const offlineNotes = await getOfflineData('delivery_notes') as any[];
        const offlineItems = await getOfflineData('delivery_note_items') as any[];
        
        return (offlineNotes || []).map(note => ({
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
          items: (offlineItems || [])
            .filter((item: any) => item.delivery_note_id === note.id)
            .map((item: any) => ({
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
      }

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

      if (!isOnline) {
        const noteData = {
          user_id: user.user.id,
          customer_name: input.customerName,
          customer_address: input.customerAddress,
          customer_phone: input.customerPhone,
          issue_date: input.issueDate || new Date().toISOString(),
          total_amount: total,
          paid_amount: input.paidAmount || 0,
          remaining_balance: total - (input.paidAmount || 0),
          extra_fields: input.extraFields,
          notes: input.notes,
          status,
        };

        const items = input.items.map(item => ({
          product_id: item.productId,
          product_code: item.productCode,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
        }));

        const id = await createDeliveryNoteOffline(noteData, items);
        return { id };
      }

      // 🔧 Convertir fecha a mediodía UTC para evitar problemas de timezone
      const issueDate = input.issueDate 
        ? `${input.issueDate}T12:00:00.000Z` 
        : new Date().toISOString();

      const { data: note, error: noteError } = await supabase
        .from("delivery_notes")
        .insert({
          user_id: user.user.id,
          customer_name: input.customerName,
          customer_address: input.customerAddress,
          customer_phone: input.customerPhone,
          issue_date: issueDate,
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
          await updateProductStock(item.productId, -item.quantity, queryClient);
        }
      }

      // 🆕 SINCRONIZAR A INDEXEDDB DESPUÉS DE CREAR
      if (note?.id) {
        try {
          await syncDeliveryNoteById(note.id);
        } catch (error) {
          console.error("Error al sincronizar remito a IndexedDB:", error);
        }
      }

      return note;
    },
    onSuccess: async () => {
      // Forzar refetch completo desde IndexedDB
      await queryClient.refetchQueries({ 
        queryKey: ["delivery-notes"],
        type: 'active'
      });
      
      invalidateProductQueries(queryClient);
      toast.success(
        isOnline
          ? "Remito creado exitosamente y stock actualizado"
          : "Remito creado (se sincronizará al conectar)"
      );
    },
    onError: (error: any) => {
      toast.error(`Error al crear remito: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateDeliveryNoteInput) => {
      if (!isOnline) {
        // Asegurar que se pasen los items para la reversión offline
        const mappedItems = updates.items?.map(item => ({
          product_id: item.productId,
          product_code: item.productCode,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
        }));
        
        await updateDeliveryNoteOffline(id, updates, mappedItems);
        return;
      }

      // PASO 1: Obtener remito original con items
      const { data: originalNote, error: fetchError } = await supabase
        .from("delivery_notes")
        .select(`*, items:delivery_note_items(*)`)
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // PASO 2: Revertir stock de items originales
      console.log("🔄 Revirtiendo stock de items originales...");
      for (const item of originalNote.items) {
        if (item.product_id) {
          // Devolver al stock (delta positivo)
          await updateProductStock(item.product_id, item.quantity, queryClient);
          console.log(`  ✅ Revertido: ${item.product_name} (+${item.quantity})`);
        }
      }

      // PASO 3: Calcular nuevo total
      let newTotal = originalNote.total_amount;
      if (updates.items) {
        newTotal = updates.items.reduce((sum, item) => 
          sum + (item.quantity * item.unitPrice), 0
        );
      }

      const newPaidAmount = updates.paidAmount ?? originalNote.paid_amount;
      const newStatus = newPaidAmount >= newTotal ? 'paid' : 'pending';

      // PASO 4: Actualizar nota principal
      // 🔧 Convertir fecha a mediodía UTC si se proporciona
      const issueDate = updates.issueDate 
        ? `${updates.issueDate}T12:00:00.000Z` 
        : undefined;

      const { error: noteError } = await supabase
        .from("delivery_notes")
        .update({
          customer_name: updates.customerName,
          customer_address: updates.customerAddress,
          customer_phone: updates.customerPhone,
          issue_date: issueDate,
          total_amount: newTotal,
          paid_amount: newPaidAmount,
          notes: updates.notes,
          status: newStatus,
        })
        .eq("id", id);

      if (noteError) throw noteError;

      // PASO 5: Reemplazar items si se proporcionaron
      if (updates.items) {
        // Eliminar items antiguos
        const { error: deleteError } = await supabase
          .from("delivery_note_items")
          .delete()
          .eq("delivery_note_id", id);

        if (deleteError) throw deleteError;

        // Insertar nuevos items
        const { error: itemsError } = await supabase
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

        if (itemsError) throw itemsError;

        // PASO 6: Descontar stock de nuevos items
        console.log("🔄 Descontando stock de nuevos items...");
        for (const item of updates.items) {
          if (item.productId) {
            // Descontar del stock (delta negativo)
            await updateProductStock(item.productId, -item.quantity, queryClient);
            console.log(`  ✅ Descontado: ${item.productName} (-${item.quantity})`);
          }
        }
      }

      // 🆕 SINCRONIZAR A INDEXEDDB DESPUÉS DE ACTUALIZAR
      try {
        await syncDeliveryNoteById(id);
      } catch (error) {
        console.error("Error al sincronizar remito actualizado a IndexedDB:", error);
      }
    },
    onSuccess: async () => {
      // Forzar refetch completo desde IndexedDB
      await queryClient.refetchQueries({ 
        queryKey: ["delivery-notes"],
        type: 'active'
      });
      
      invalidateProductQueries(queryClient);
      toast.success(
        isOnline
          ? "Remito actualizado exitosamente"
          : "Remito actualizado localmente"
      );
    },
    onError: (error: any) => {
      toast.error(`Error al actualizar remito: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline) {
        await deleteDeliveryNoteOffline(id);
        return;
      }

      const { data: note, error: fetchError } = await supabase
        .from("delivery_notes")
        .select(`*, items:delivery_note_items(*)`)
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      for (const item of note.items) {
        if (item.product_id) {
          await updateProductStock(item.product_id, item.quantity, queryClient);
        }
      }

      const { error: deleteError } = await supabase
        .from("delivery_notes")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      // 🆕 SINCRONIZAR A INDEXEDDB DESPUÉS DE ELIMINAR
      try {
        await syncDeliveryNoteById(id);
      } catch (error) {
        console.error("Error al sincronizar eliminación a IndexedDB:", error);
      }
    },
    onSuccess: async () => {
      // Forzar refetch completo desde IndexedDB
      await queryClient.refetchQueries({ 
        queryKey: ["delivery-notes"],
        type: 'active'
      });
      
      invalidateProductQueries(queryClient);
      toast.success(
        isOnline
          ? "Remito eliminado y stock revertido"
          : "Remito eliminado (se sincronizará al conectar)"
      );
    },
    onError: (error: any) => {
      toast.error(`Error al eliminar remito: ${error.message}`);
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline) {
        // Obtener el remito desde IndexedDB
        const offlineNotes = await getOfflineData('delivery_notes') as any[];
        const note = offlineNotes.find((n: any) => n.id === id);
        
        if (!note) throw new Error("Remito no encontrado");
        
        await markDeliveryNoteAsPaidOffline(id, note.total_amount);
        return;
      }

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

      // 🆕 SINCRONIZAR A INDEXEDDB DESPUÉS DE MARCAR COMO PAGADO
      try {
        await syncDeliveryNoteById(id);
      } catch (error) {
        console.error("Error al sincronizar pago a IndexedDB:", error);
      }
    },
    onSuccess: async () => {
      // Forzar refetch completo desde IndexedDB
      await queryClient.refetchQueries({ 
        queryKey: ["delivery-notes"],
        type: 'active'
      });
      
      toast.success(
        isOnline
          ? "Remito marcado como pagado"
          : "Remito marcado como pagado (se sincronizará al conectar)"
      );
    },
  });

  return {
    deliveryNotes,
    isLoading,
    createDeliveryNote: createMutation.mutateAsync,
    updateDeliveryNote: updateMutation.mutateAsync,
    deleteDeliveryNote: deleteMutation.mutateAsync,
    markAsPaid: markAsPaidMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
