import 'dotenv/config';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema';
import { process_db_utils } from './utils/index';

const { DB_DATABASE, DB_HOST, DB_PASSWORD, DB_PORT, DB_USER } = process.env;
export const dbConfig = {
    user: DB_USER,
    password: DB_PASSWORD,
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_DATABASE,
};

const migrationConnection = new Pool({ ...dbConfig, max: 1 });
export const pool = new Pool(dbConfig);
export const db = drizzle(pool, { schema: schema, logger: true });


export const mainMigrate = async () => {
    const dbStartupUtils = process_db_utils();
    // before migrate
    await dbStartupUtils.beforeMigrate();
    await migrate(drizzle(migrationConnection), { migrationsFolder: 'drizzle' });
    await migrationConnection.end();
    // after migrate
    await dbStartupUtils.afterMigrate();
    console.log('db ok');
};
