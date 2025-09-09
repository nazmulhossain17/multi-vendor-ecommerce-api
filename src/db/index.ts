import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema"; // import everything from schema.ts
import config from "../config/config";

const pool = new Pool({
  connectionString: config.database_url,
});

// ✅ include schema here
export const db = drizzle(pool, { schema });

export { schema };
