import type { Database } from './profiles.js';

export interface Connection extends Database { release(): void }
export interface Pool extends Database { connect(): Promise<Connection> }

export async function transaction<T>(pool: Pool, work: (db: Database) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
