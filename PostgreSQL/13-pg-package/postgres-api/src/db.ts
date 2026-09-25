import { Pool } from "pg";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

export const pool = new Pool({
  connectionString: databaseUrl,

  max: 10,

  idleTimeoutMillis: 10_000,

  connectionTimeoutMillis: 2_000,

});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});