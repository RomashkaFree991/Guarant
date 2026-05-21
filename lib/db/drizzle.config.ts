import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Загружаем .env из корня монорепо.
dotenv.config({ path: path.join(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const schemaDir = path.join(__dirname, "src", "schema");

export default defineConfig({
  schema: [
    path.join(schemaDir, "users.ts"),
    path.join(schemaDir, "deals.ts"),
    path.join(schemaDir, "events.ts"),
    path.join(schemaDir, "idempotency.ts"),
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
