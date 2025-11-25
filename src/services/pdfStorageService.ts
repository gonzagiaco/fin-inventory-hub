import { supabase } from "@/integrations/supabase/client";
import { DeliveryNote } from "@/types";
import { generateDeliveryNotePDFDocument } from "@/utils/deliveryNotePdfGenerator";

const BUCKET_NAME = "delivery-notes-pdf";

/**
 * Genera el nombre del archivo PDF para un remito
 */
const generateFileName = (note: DeliveryNote): string => {
  const customerSlug = note.customerName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 30);
  const dateStr = new Date(note.issueDate).toISOString().split("T")[0];
  return `remito-${customerSlug}-${dateStr}-${note.id.substring(0, 8)}.pdf`;
};

/**
 * Sube un PDF de remito a Supabase Storage y retorna la URL pública
 */
export const uploadDeliveryNotePDF = async (
  note: DeliveryNote
): Promise<{ url: string; error: string | null }> => {
  try {
    // Usar la función del generador existente
    const doc = generateDeliveryNotePDFDocument(note);
    const pdfBlob = doc.output("blob");
    const fileName = generateFileName(note);
    const filePath = `remitos/${fileName}`;

    // Verificar si ya existe y eliminarlo para actualizarlo
    const { data: existingFiles } = await supabase.storage
      .from(BUCKET_NAME)
      .list("remitos", {
        search: fileName,
      });

    if (existingFiles && existingFiles.length > 0) {
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    }

    // Subir el nuevo archivo
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("Error al subir PDF:", error);
      return { url: "", error: error.message };
    }

    // Obtener la URL pública
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    return { url: publicUrl, error: null };
  } catch (err) {
    console.error("Error inesperado al subir PDF:", err);
    return {
      url: "",
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
};

/**
 * Elimina un PDF de remito de Supabase Storage
 */
export const deleteDeliveryNotePDF = async (
  note: DeliveryNote
): Promise<boolean> => {
  try {
    const fileName = generateFileName(note);
    const filePath = `remitos/${fileName}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error("Error al eliminar PDF:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error inesperado al eliminar PDF:", err);
    return false;
  }
};
