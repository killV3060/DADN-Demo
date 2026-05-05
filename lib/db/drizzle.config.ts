import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "url";

// 👇 fix __dirname cho môi trường ESM/CJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 👇 dùng __dirname thay vì import.meta.dirname
loadEnv({
  path: path.resolve(__dirname, "..", "..", ".env"),
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});