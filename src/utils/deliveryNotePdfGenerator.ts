import jsPDF from "jspdf";
import { DeliveryNote } from "@/types";
import { formatARS } from "@/utils/numberParser";
import { getCompanyNameForDocs, getUserProfile } from "@/lib/userProfile";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el blob"));
    reader.readAsDataURL(blob);
  });
}

async function loadImageAsDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo descargar el logo para el PDF");
  const blob = await res.blob();
  return await blobToDataUrl(blob);
}

/**
 * Genera el documento PDF para un remito (sin descargarlo ni crear blob URL)
 * Esta función es reutilizable por otros servicios (ej: Supabase Storage)
 */
export const generateDeliveryNotePDFDocument = async (note: DeliveryNote): Promise<jsPDF> => {
  const doc = new jsPDF();
  const companyName = getCompanyNameForDocs(note.userId);
  const profile = getUserProfile(note.userId);

  try {
    if (profile?.companyLogoUrl) {
      const img = await loadImageAsDataUrl(profile.companyLogoUrl);
      const format = img.includes("image/png") ? "PNG" : "JPEG";
      const boxX = 20;
      const boxY = 8;
      const boxSize = 18;
      const props: any = (doc as any).getImageProperties?.(img);
      const iw = Number(props?.width) || 1;
      const ih = Number(props?.height) || 1;
      const scale = Math.min(boxSize / iw, boxSize / ih);
      const w = Math.max(1, iw * scale);
      const h = Math.max(1, ih * scale);
      const x = boxX + (boxSize - w) / 2;
      const y = boxY + (boxSize - h) / 2;
      doc.addImage(img, format as any, x, y, w, h);
    }
  } catch {}

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(companyName, 105, 14, { align: "center" });
  
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("REMITO", 105, 28, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const issueDate = new Date(note.issueDate).toLocaleDateString("es-AR");
  doc.text(`Fecha de Emisión: ${issueDate}`, 20, 35);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 20, 50);
  doc.setFont("helvetica", "normal");
  doc.text(note.customerName, 20, 57);
  if (note.customerAddress) {
    doc.text(note.customerAddress, 20, 64);
  }
  if (note.customerPhone) {
    doc.text(`Tel: ${note.customerPhone}`, 20, note.customerAddress ? 71 : 64);
  }
  
  const startY = note.customerAddress ? (note.customerPhone ? 85 : 78) : (note.customerPhone ? 78 : 71);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Productos", 20, startY);
  
  doc.setFontSize(10);
  const tableY = startY + 8;
  doc.text("Código", 20, tableY);
  doc.text("Descripción", 50, tableY);
  doc.text("Cantidad", 130, tableY);
  doc.text("Precio Unit.", 155, tableY);
  doc.text("Subtotal", 180, tableY);
  
  doc.line(20, tableY + 2, 195, tableY + 2);
  
  doc.setFont("helvetica", "normal");
  let currentY = tableY + 10;
  note.items?.forEach((item) => {
    doc.text(item.productCode, 20, currentY);
    doc.text(item.productName.substring(0, 25), 50, currentY);
    doc.text(item.quantity.toString(), 130, currentY);
    doc.text(formatARS(item.unitPrice), 155, currentY);
    doc.text(formatARS(item.subtotal), 180, currentY);
    currentY += 7;
  });
  
  currentY += 5;
  doc.line(20, currentY, 195, currentY);
  currentY += 8;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total: ${formatARS(note.totalAmount)}`, 180, currentY, { align: "right" });
  
  if (note.paidAmount > 0) {
    currentY += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Monto Pagado: ${formatARS(note.paidAmount)}`, 180, currentY, { align: "right" });
    currentY += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`Restante: ${formatARS(note.remainingBalance)}`, 180, currentY, { align: "right" });
  }
  
  currentY += 10;
  doc.setFontSize(12);
  if (note.status === 'paid') {
    doc.setTextColor(34, 197, 94);
    doc.text("✓ PAGADO", 20, currentY);
  } else {
    doc.setTextColor(234, 179, 8);
    doc.text("⏳ PENDIENTE", 20, currentY);
  }
  doc.setTextColor(0, 0, 0);
  
  if (note.notes) {
    currentY += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", 20, currentY);
    currentY += 5;
    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(note.notes, 170);
    doc.text(splitNotes, 20, currentY);
  }
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Gracias por su compra", 105, 280, { align: "center" });
  
  return doc;
};

/**
 * Genera un PDF blob sin descargarlo automáticamente
 * @returns URL del blob para compartir (solo funciona localmente)
 */
export const generateDeliveryNotePDFBlob = async (note: DeliveryNote): Promise<string> => {
  const doc = await generateDeliveryNotePDFDocument(note);
  const pdfBlob = doc.output('blob');
  return URL.createObjectURL(pdfBlob);
};

/**
 * Genera y descarga el PDF automáticamente
 */
export const generateDeliveryNotePDF = async (note: DeliveryNote): Promise<string> => {
  const doc = await generateDeliveryNotePDFDocument(note);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  
  doc.save(`remito-${note.customerName.replace(/\s+/g, "-")}-${Date.now()}.pdf`);
  
  return pdfUrl;
};
