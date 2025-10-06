import * as XLSX from "xlsx";
import { StockItem } from "@/types";

interface ImportResult {
  importedProducts: StockItem[];
  newCount: number;
  updateCount: number;
}

// Column name mappings for normalization
const COLUMN_MAPPINGS = {
  code: ["code", "codigo", "código", "id", "sku"],
  name: ["name", "nombre", "description", "descripcion", "descripción", "producto", "product"],
  price: ["price", "precio", "cost", "costo", "costprice"],
};

/**
 * Normalizes column names by removing accents, spaces, and converting to lowercase
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Finds the matching column name from the available headers
 */
function findColumn(headers: string[], possibleNames: string[]): string | null {
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: normalizeColumnName(h),
  }));

  for (const possibleName of possibleNames) {
    const normalized = normalizeColumnName(possibleName);
    const match = normalizedHeaders.find((h) => h.normalized === normalized);
    if (match) return match.original;
  }

  return null;
}

/**
 * Detects the header row by looking for rows that contain column names
 */
function detectHeaderRow(data: any[]): number {
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    const keys = Object.keys(row);
    
    // Check if this row contains at least 2 of our expected columns
    const codeMatch = findColumn(keys, COLUMN_MAPPINGS.code);
    const nameMatch = findColumn(keys, COLUMN_MAPPINGS.name);
    const priceMatch = findColumn(keys, COLUMN_MAPPINGS.price);
    
    if ((codeMatch || nameMatch) && priceMatch) {
      return i;
    }
  }
  
  return 0; // Default to first row
}

/**
 * Tries to find valid data in any sheet of the workbook
 */
function findValidSheet(workbook: XLSX.WorkBook): { sheetName: string; data: any[] } | null {
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    
    if (data.length === 0) continue;
    
    // Try to detect if this sheet has valid product data
    const headerRowIndex = detectHeaderRow(data);
    if (headerRowIndex >= 0) {
      const relevantData = data.slice(headerRowIndex);
      const keys = Object.keys(relevantData[0] || {});
      
      const codeMatch = findColumn(keys, COLUMN_MAPPINGS.code);
      const nameMatch = findColumn(keys, COLUMN_MAPPINGS.name);
      const priceMatch = findColumn(keys, COLUMN_MAPPINGS.price);
      
      if ((codeMatch || nameMatch) && priceMatch) {
        return { sheetName, data: relevantData };
      }
    }
  }
  
  return null;
}

/**
 * Imports products from an Excel file with robust column detection and normalization
 * 
 * @param file - The Excel file to import
 * @param existingProducts - Array of existing products to check for updates
 * @param supplierId - The supplier ID to assign to imported products
 * @returns Object containing imported products and counts of new/updated items
 */
export async function importProductsFromExcel(
  file: File,
  existingProducts: StockItem[],
  supplierId: string
): Promise<ImportResult> {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    
    // Find a valid sheet with product data
    const validSheet = findValidSheet(workbook);
    
    if (!validSheet) {
      throw new Error("No valid product data found in any sheet");
    }
    
    const { data: jsonData } = validSheet;
    
    if (jsonData.length === 0) {
      throw new Error("The file is empty or has no valid data");
    }
    
    // Get the headers from the first data row
    const headers = Object.keys(jsonData[0]);
    
    // Find the column names
    const codeColumn = findColumn(headers, COLUMN_MAPPINGS.code);
    const nameColumn = findColumn(headers, COLUMN_MAPPINGS.name);
    const priceColumn = findColumn(headers, COLUMN_MAPPINGS.price);
    
    if (!priceColumn) {
      throw new Error("Could not find price column. Expected columns: code, name/description, price");
    }
    
    let newCount = 0;
    let updateCount = 0;
    const importedProducts: StockItem[] = [];
    
    // Process each row
    for (const row of jsonData) {
      // Extract values using detected columns
      const code = codeColumn ? String(row[codeColumn] || "").trim() : "";
      const name = nameColumn ? String(row[nameColumn] || "").trim() : "";
      const priceValue = priceColumn ? row[priceColumn] : 0;
      
      // Parse cost price
      let costPrice = 0;
      if (typeof priceValue === "number") {
        costPrice = priceValue;
      } else if (typeof priceValue === "string") {
        // Remove currency symbols and parse
        const cleaned = priceValue.replace(/[^0-9.,]/g, "").replace(",", ".");
        costPrice = parseFloat(cleaned);
      }
      
      // Validate row - must have either code or name, and a valid price
      if ((!code && !name) || isNaN(costPrice) || costPrice <= 0) {
        continue; // Skip invalid rows
      }
      
      // Check if product already exists (by code and supplierId)
      const existingProduct = existingProducts.find(
        (p) => p.code === code && p.supplierId === supplierId
      );
      
      if (existingProduct) {
        // Update existing product
        updateCount++;
        importedProducts.push({
          ...existingProduct,
          name: name || existingProduct.name,
          costPrice,
        });
      } else {
        // Create new product
        newCount++;
        importedProducts.push({
          id: crypto.randomUUID(),
          code: code || crypto.randomUUID().substring(0, 8),
          name: name || "Producto sin nombre",
          quantity: 0,
          category: "General",
          costPrice,
          supplierId,
          specialDiscount: false,
          minStockLimit: 10,
        });
      }
    }
    
    return {
      importedProducts,
      newCount,
      updateCount,
    };
  } catch (error) {
    console.error("Error importing Excel file:", error);
    throw error;
  }
}
