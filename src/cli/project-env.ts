import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Directory shipped as `dist/infra` (docker-compose.yml lives here). */
export function getInfraPath(): string {
  return path.resolve(__dirname, "../infra");
}

/** First `.env` found walking up from `process.cwd()`, or `undefined`. */
export function resolveProjectDotenvPath(): string | undefined {
  let dir = path.resolve(process.cwd());
  for (;;) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

/** Preferred `.env` path for messages when none exists yet. */
export function getProjectEnvPath(): string {
  return resolveProjectDotenvPath() ?? path.join(process.cwd(), ".env");
}

/** Args to insert after `docker` and before subcommands, e.g. `compose --env-file ...`. */
export function dockerComposeEnvArgs(): string[] {
  const envFile = resolveProjectDotenvPath();
  if (!envFile) {
    return [];
  }
  return ["--env-file", envFile];
}

/**
 * Load `.env` into `process.env` (first file found walking up from cwd).
 * Does not override variables already set in the environment (dotenv default).
 */
export function loadProjectDotenv(): void {
  const envFile = resolveProjectDotenvPath();
  if (!envFile) {
    return;
  }
  dotenv.config({ path: envFile });
}
