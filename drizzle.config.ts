import { defineConfig } from "drizzle-kit";
import { dbConfig } from './src/db';

export default defineConfig({
    dialect: 'postgresql', // "mysql" | "sqlite" | "postgresql"
    schema: './src/db/schema.ts',
    out: './drizzle',
    dbCredentials: {
        user: dbConfig.user,
        password: dbConfig.password,
        host: dbConfig.host!,
        port: dbConfig.port!,
        database: dbConfig.database!,
    }
});
