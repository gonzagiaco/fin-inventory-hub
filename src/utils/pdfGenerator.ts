import jsPDF from "jspdf";
import { Client } from "@/types";

export const generateInvoicePDF = (client: Client): void => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURA", 105, 20, { align: "center" });
  
  // Issue and due dates
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha de Emisión: ${client.issueDate}`, 20, 35);
  doc.text(`Fecha de Vencimiento: ${client.dueDate}`, 20, 42);
  
  // Client info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 20, 55);
  doc.setFont("helvetica", "normal");
  doc.text(client.name, 20, 62);
  if (client.address) {
    doc.text(client.address, 20, 69);
  }
  if (client.phone) {
    doc.text(`Tel: ${client.phone}`, 20, client.address ? 76 : 69);
  }
  if (client.email) {
    doc.text(`Email: ${client.email}`, 20, client.address ? (client.phone ? 83 : 76) : (client.phone ? 76 : 69));
  }
  
  // Products table
  const startY = client.address ? (client.phone || client.email ? 95 : 85) : (client.phone || client.email ? 85 : 75);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Productos", 20, startY);
  
  // Table headers
  doc.setFontSize(10);
  const tableY = startY + 8;
  doc.text("Código", 20, tableY);
  doc.text("Descripción", 50, tableY);
  doc.text("Precio Unit.", 120, tableY);
  doc.text("Cant.", 155, tableY);
  doc.text("Subtotal", 175, tableY);
  
  // Table line
  doc.line(20, tableY + 2, 195, tableY + 2);
  
  // Products
  doc.setFont("helvetica", "normal");
  let currentY = tableY + 10;
  client.products.forEach((product) => {
    doc.text(product.code, 20, currentY);
    doc.text(product.name.substring(0, 30), 50, currentY);
    doc.text(`$${product.salePrice.toFixed(2)}`, 120, currentY);
    doc.text(product.quantity.toString(), 155, currentY);
    doc.text(`$${product.subtotal.toFixed(2)}`, 175, currentY);
    currentY += 7;
  });
  
  // Total section
  currentY += 5;
  doc.line(20, currentY, 195, currentY);
  currentY += 8;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total: $${client.amount.toFixed(2)}`, 175, currentY, { align: "right" });
  
  // Payment info if exists
  if (client.amountPaid > 0) {
    currentY += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Monto Pagado: $${client.amountPaid.toFixed(2)}`, 175, currentY, { align: "right" });
    currentY += 6;
    const remaining = client.amount - client.amountPaid;
    doc.setFont("helvetica", "bold");
    doc.text(`Restante: $${remaining.toFixed(2)}`, 175, currentY, { align: "right" });
  }
  
  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Gracias por su compra", 105, 280, { align: "center" });
  
  // Save the PDF
  doc.save(`factura-${client.name.replace(/\s+/g, "-")}-${Date.now()}.pdf`);
};
