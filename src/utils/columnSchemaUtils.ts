import { ColumnSchema } from "@/types/productList";

/**
 * Combina esquemas de columnas existentes con nuevos, preservando configuraciones
 * @param existingSchema - Esquema actual de la lista
 * @param newSchema - Esquema detectado del nuevo archivo
 * @returns Esquema combinado con nuevas columnas agregadas
 */
export function mergeColumnSchemas(
  existingSchema: ColumnSchema[],
  newSchema: ColumnSchema[]
): ColumnSchema[] {
  const existingMap = new Map(existingSchema.map((col) => [col.key, col]));
  const maxOrder = Math.max(...existingSchema.map((c) => c.order), -1);

  const merged: ColumnSchema[] = [...existingSchema];
  let nextOrder = maxOrder + 1;

  newSchema.forEach((newCol) => {
    if (!existingMap.has(newCol.key)) {
      merged.push({
        ...newCol,
        order: nextOrder++,
        visible: true,
      });
    }
  });

  return merged;
}

/**
 * Detecta nuevas columnas desde los datos de productos
 * @param products - Lista de productos con data
 * @returns Array de claves de columnas detectadas en data
 */
export function detectNewColumnsFromProducts(products: Array<{ data: Record<string, any> }>): string[] {
  const allKeys = new Set<string>();

  products.forEach((product) => {
    Object.keys(product.data).forEach((key) => {
      allKeys.add(key);
    });
  });

  return Array.from(allKeys);
}

/**
 * Crea un ColumnSchema básico desde claves de columnas
 * @param keys - Array de claves de columnas
 * @param startOrder - Orden inicial para las nuevas columnas
 * @returns Array de ColumnSchema
 */
export function createSchemaFromKeys(keys: string[], startOrder: number = 0): ColumnSchema[] {
  return keys.map((key, index) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    type: "text" as const,
    visible: true,
    order: startOrder + index,
    isStandard: false,
  }));
}
