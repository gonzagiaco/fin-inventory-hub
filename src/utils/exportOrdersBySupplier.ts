import * as XLSX from "xlsx";
import { RequestItem, Supplier } from "@/types";
import { formatARS } from "@/utils/numberParser";

/**
 * Groups request items by supplier and exports one Excel file per supplier
 * Files are named as order_<supplier>_<date>.xlsx
 */
export function exportOrdersBySupplier(
  requestList: RequestItem[],
  suppliers: Supplier[]
) {
  // Group items by supplier
  const itemsBySupplier = requestList.reduce((acc, item) => {
    if (!acc[item.supplierId]) {
      acc[item.supplierId] = [];
    }
    acc[item.supplierId].push(item);
    return acc;
  }, {} as Record<string, RequestItem[]>);

  // Get current date for filename
  const date = new Date().toISOString().split("T")[0];

  // Helper to get supplier name
  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name || "Unknown";
  };

  // Create one file per supplier
  Object.entries(itemsBySupplier).forEach(([supplierId, items]) => {
    const supplierName = getSupplierName(supplierId)
      .toLowerCase()
      .replace(/\s+/g, "_");

    // Calculate totals
    const total = items.reduce(
      (sum, item) => sum + item.costPrice * item.quantity,
      0
    );

    // Create worksheet data
    const worksheetData = [
      ["Código", "Nombre", "Cantidad", "Precio Unitario", "Subtotal"],
      ...items.map((item) => [
        item.code,
        item.name,
        item.quantity,
        (item.costPrice).toFixed(2),
        (item.costPrice * item.quantity).toFixed(2),
      ]),
      [],
      ["", "", "", "TOTAL:", total.toFixed(2)],
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Pedido");

    // Generate file name
    const fileName = `order_${supplierName}_${date}.xlsx`;

    // Save file
    XLSX.writeFile(wb, fileName);
  });
}
