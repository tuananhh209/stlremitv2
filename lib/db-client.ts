import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy init — don't throw at module load time (breaks Docker build).
// The error will surface at runtime when a DB query is actually made.
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
};

// Use a getter so the connection is only created when first accessed
let _db: ReturnType<typeof drizzle> | null = null;

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!_db) {
      const sql = neon(getDatabaseUrl());
      _db = drizzle(sql, { schema });
    }
    return (_db as any)[prop];
  },
});

export type DB = typeof db;
