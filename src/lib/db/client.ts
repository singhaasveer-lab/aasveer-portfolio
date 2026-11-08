import Database from "better-sqlite3";
import fs from "node:fs";
import { buildDatabase } from "./build";
import {
  contentFingerprint,
  defaultContentDir,
  defaultSchemaPath,
  schemaFingerprint,
} from "./fingerprint";
import { databasePath } from "./paths";

/** How often, at most, a development server re-checks the content files for edits. */
const DEV_RECHECK_MS = 1000;

/** A database built from an older schema (or, in development, older content) than the code expects. */
export class StaleDatabaseError extends Error {
  constructor(file: string, reason: string) {
    super(
      `Portfolio database at ${file} is out of date: ${reason}. ` +
        "Run `pnpm db:build` (or restart `pnpm dev`) to rebuild it from content/ and db/schema.sql.",
    );
    this.name = "StaleDatabaseError";
  }
}

/*
 * The cached connection lives on globalThis, so a development hot reload of this module reuses
 * (and can close) the open handle instead of leaking it. On Windows a leaked handle would keep
 * the file locked and make a rebuild impossible.
 */
interface DbState {
  connection: Database.Database | null;
  path: string | null;
  checkedAt: number;
}
const store = globalThis as typeof globalThis & { __portfolioDb?: DbState };
const state: DbState = (store.__portfolioDb ??= { connection: null, path: null, checkedAt: 0 });

const isDevelopment = () => process.env.NODE_ENV === "development";

function buildInfo(db: Database.Database): Record<string, string> | null {
  try {
    const rows = db.prepare(`SELECT key, value FROM build_info`).all() as {
      key: string;
      value: string;
    }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return null; // built before build_info existed
  }
}

/** Why the open database no longer matches its sources, or null when it is current. */
function staleness(db: Database.Database, checkContent: boolean): string | null {
  const info = buildInfo(db);
  if (!info) return "it was built before schema checks existed (no build_info table)";
  const schemaPath = info.schema_path ?? defaultSchemaPath();
  if (fs.existsSync(schemaPath) && info.schema_hash !== schemaFingerprint(schemaPath)) {
    return "db/schema.sql has changed since it was built";
  }
  const contentDir = info.content_dir ?? defaultContentDir();
  if (
    checkContent &&
    fs.existsSync(contentDir) &&
    info.content_hash !== contentFingerprint(contentDir)
  ) {
    return "the content files have changed since it was built";
  }
  return null;
}

function open(file: string): Database.Database {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  db.pragma("foreign_keys = ON");
  return db;
}

/**
 * Opens the build-time database read-only. Only src/lib/db/queries.ts calls this.
 * The database is created by `pnpm db:build` (scripts/build-db.ts) before `next dev` and
 * `next build` run. If it was built from an older schema, or (during development) from older
 * content, a development server rebuilds it in place; anywhere else a StaleDatabaseError says how
 * to fix it, so a mismatch never surfaces as a missing-column error.
 */
export function getDb(): Database.Database {
  const file = databasePath();
  const now = Date.now();
  const recheck = isDevelopment() && now - state.checkedAt >= DEV_RECHECK_MS;
  if (state.connection && state.path === file && !recheck) return state.connection;

  if (!state.connection || state.path !== file) {
    closeDb();
    if (!fs.existsSync(file)) {
      throw new Error(`Portfolio database not found at ${file}. Run \`pnpm db:build\` first.`);
    }
    state.connection = open(file);
    state.path = file;
  }
  state.checkedAt = now;

  const reason = staleness(state.connection, isDevelopment());
  if (!reason) return state.connection;
  if (!isDevelopment()) {
    // Not cached: every later call checks again (and fails the same way) until it is rebuilt.
    closeDb();
    throw new StaleDatabaseError(file, reason);
  }

  // Development: rebuild from the sources it was built from (or the defaults), then reopen.
  const info = buildInfo(state.connection);
  closeDb();
  buildDatabase({
    contentDir: info?.content_dir ?? defaultContentDir(),
    schemaPath: info?.schema_path ?? defaultSchemaPath(),
    outPath: file,
  });
  console.info(`[db] Rebuilt ${file}: ${reason}.`);
  state.connection = open(file);
  state.path = file;
  state.checkedAt = Date.now();
  return state.connection;
}

/** Closes the cached connection. Used by tests that rebuild the database. */
export function closeDb(): void {
  state.connection?.close();
  state.connection = null;
  state.path = null;
  state.checkedAt = 0;
}
