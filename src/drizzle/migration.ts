import dotenv from "dotenv"
import path from "path"
dotenv.config({
    path: path.join(__dirname, '../../.env')
});

import {drizzle} from "drizzle-orm/postgres-js";
import {migrate} from "drizzle-orm/postgres-js/migrator";
import postgres  from "postgres";

const migrationclient = postgres(process.env.DATABASE_URL as string)
async function main() {
    const db = drizzle(migrationclient, { migrationsFolder: "./index" } as any);

    const result = await db.execute('select 1');

    await migrationclient.end();
}

main()