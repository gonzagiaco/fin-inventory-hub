import jsPDF from "jspdf";
import { DeliveryNote } from "@/types";

export const generateDeliveryNotePDF = (note: DeliveryNote): string => {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("REMITO", 105, 20, { align: "center" });
  
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
    doc.text(`$${item.unitPrice.toFixed(2)}`, 155, currentY);
    doc.text(`$${item.subtotal.toFixed(2)}`, 180, currentY);
    currentY += 7;
  });
  
  currentY += 5;
  doc.line(20, currentY, 195, currentY);
  currentY += 8;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total: $${note.totalAmount.toFixed(2)}`, 180, currentY, { align: "right" });
  
  if (note.paidAmount > 0) {
    currentY += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Monto Pagado: $${note.paidAmount.toFixed(2)}`, 180, currentY, { align: "right" });
    currentY += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`Restante: $${note.remainingBalance.toFixed(2)}`, 180, currentY, { align: "right" });
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
  
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  
  doc.save(`remito-${note.customerName.replace(/\s+/g, "-")}-${Date.now()}.pdf`);
  
  return pdfUrl;
};
