// SIMULATING POSTGRESQL DB WITH DRIZZLE
import pkg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import fs from "fs";
import * as schema from './index';

const { Pool } = pkg;

// try catch to know if caCert was loaded successfully
let caCert: string;
try {
    caCert = fs.readFileSync("./ca.pem", "utf8");
    console.log("✅ CA certificate loaded from file");
} catch (error) {
    const err = error as Error;
    caCert = process.env.CA_CERT as string;
    if (caCert) {
        console.log("✅ CA certificate loaded from environment");
    } else {
        console.log("⚠️ No CA certificate found, using rejectUnauthorized: false", err.message);
    }
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    //   ssl: caCert
    //     ? {
    //         rejectUnauthorized: true,
    //         ca: caCert,
    //       }
    //     : {
    //         rejectUnauthorized: false, // insecure fallback — avoid in production
    //       },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

const connectDB = async (): Promise<boolean> => {
    try {
        console.log("connecting to postgres db .....");
        const client = await pool.connect();
        console.log("connected to database postgres");

        const result = await client.query("SELECT NOW() as time");
        console.log("server time :", result.rows[0].time);

        client.release();
        return true;
    } catch (error) {
        const err = error as Error;
        console.error("database connection failed ", err.message);
        return false;
    }
};

const db = drizzle(pool, { schema });

export { db, connectDB };