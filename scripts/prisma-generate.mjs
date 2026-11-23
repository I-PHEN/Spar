import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const usePostgres =
  process.env.VERCEL === "1" ||
  process.env.VERCEL === "true" ||
  (process.env.DATABASE_URL ?? "").startsWith("postgres");

const schema = usePostgres
  ? "prisma/schema.postgres.prisma"
  : "prisma/schema.prisma";

const prismaCli = resolve("node_modules", "prisma", "build", "index.js");
console.log(`[prisma-generate] Using ${schema}`);
execFileSync(process.execPath, [prismaCli, "generate", `--schema=${schema}`], {
  stdio: "inherit",
});
