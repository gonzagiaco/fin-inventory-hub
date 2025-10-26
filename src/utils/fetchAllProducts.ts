import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all records from a Supabase table, overcoming the 1000-row limit
 * by making parallel paginated requests.
 */
export async function fetchAllFromTable<T = any>(
  tableName: string,
  listIds?: string[]
): Promise<T[]> {
  const BATCH_SIZE = 1000;
  
  // First fetch to get total count
  let countQuery = (supabase as any).from(tableName).select("*", { count: "exact", head: true });
  
  if (listIds && listIds.length > 0) {
    countQuery = countQuery.in("list_id", listIds);
  }
  
  const { count, error: countError } = await countQuery;
  if (countError) throw countError;
  if (!count || count === 0) return [];
  
  // If less than 1000, make a single fetch
  if (count <= BATCH_SIZE) {
    let dataQuery = (supabase as any).from(tableName).select("*");
    if (listIds && listIds.length > 0) {
      dataQuery = dataQuery.in("list_id", listIds);
    }
    const { data, error } = await dataQuery;
    if (error) throw error;
    return (data || []) as T[];
  }
  
  // Parallel fetch in batches of 1000
  const numberOfBatches = Math.ceil(count / BATCH_SIZE);
  const promises = [];
  
  for (let i = 0; i < numberOfBatches; i++) {
    const from = i * BATCH_SIZE;
    const to = from + BATCH_SIZE - 1;
    
    let batchQuery = (supabase as any).from(tableName).select("*").range(from, to);
    if (listIds && listIds.length > 0) {
      batchQuery = batchQuery.in("list_id", listIds);
    }
    
    promises.push(batchQuery);
  }
  
  // Execute all fetches in parallel
  const results = await Promise.all(promises);
  
  // Combine results
  const allData: T[] = [];
  results.forEach(({ data, error }) => {
    if (error) throw error;
    if (data) allData.push(...(data as T[]));
  });
  
  return allData;
}
