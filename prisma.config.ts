import "dotenv/config";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

// STRICTLY use Non-Pooling URL for structural schema changes
const resolvedDbUrl = 
  process.env.POSTGRES_URL_NON_POOLING || 
  process.env.DIRECT_URL || 
  process.env.DATABASE_URL || 
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: resolvedDbUrl,
  },
});