import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log connection events
pool.on('connect', () => {
  console.log('📦 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Create Drizzle instance with schema
export const db = drizzle(pool, { schema });

// Export the pool for raw queries if needed
export { pool };

// Export schema for convenience
export * from './schema.js';

// Transaction helper type
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Helper function for transactions
export async function withTransaction<T>(
  callback: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(callback);
}

export default db;
