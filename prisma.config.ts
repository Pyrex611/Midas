import "dotenv/config";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load environment files created by Vercel CLI or local setup
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

// Support Vercel Postgres variables or standard DATABASE_URL
const resolvedDbUrl = 
  process.env.DATABASE_URL || 
  process.env.POSTGRES_PRISMA_URL || 
  process.env.POSTGRES_URL || 
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