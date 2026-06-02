import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

import { env } from "./env";

// Use a getter so the connection is only created when first accessed
let _db: ReturnType<typeof drizzle> | null = null;

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!_db) {
      const sql = neon(env.DATABASE_URL);
      _db = drizzle(sql, { schema });
    }
    return (_db as any)[prop];
  },
});

export type DB = typeof db;
