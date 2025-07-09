import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Performance optimizations
  max: 20, // Maximum number of connections in the pool
  min: 5, // Minimum number of connections in the pool
  acquireTimeoutMillis: 5000, // Wait up to 5 seconds for connection
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Connection timeout
  // Enable connection pooling optimizations
  allowExitOnIdle: false
});

export const db = drizzle(pool, { schema });