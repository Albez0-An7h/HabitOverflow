import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/**
 * Helper function to safely handle PostgrestFilterBuilder's in() method with TypeScript
 * This converts a promise to an array which is needed in some cases
 */
export async function resolvePromiseToArray<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    const result = await promise;
    return result;
  } catch (error) {
    console.error('Error resolving promise to array:', error);
    return [];
  }
}

/**
 * Helper function to safely handle Supabase query results
 */
export async function executeSupabaseQuery<T>(
  queryBuilder: PostgrestFilterBuilder<any, any, T[], any, any>
): Promise<T[]> {
  try {
    const { data, error } = await queryBuilder;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error executing Supabase query:', error);
    return [];
  }
}
