import "server-only";

import mongoose, { type ConnectOptions, type Mongoose } from "mongoose";

import { getServerEnv } from "@/lib/config/env";
import { logger } from "@/lib/logger";

const log = logger.child("db");

export type DatabaseState =
  "disconnected" | "connected" | "connecting" | "disconnecting" | "uninitialized";

export interface DatabaseStatus {
  /** False when MONGODB_URI is absent; the app can still render marketing pages. */
  configured: boolean;
  state: DatabaseState;
  databaseName: string | null;
  host: string | null;
}

interface ConnectionCache {
  instance: Mongoose | null;
  /** In-flight connection so concurrent callers share a single handshake. */
  promise: Promise<Mongoose> | null;
  listenersBound: boolean;
}

declare global {
  var __solvepilotMongooseCache: ConnectionCache | undefined;
}

/**
 * The cache lives on `globalThis` so hot reloads in development (and repeated
 * imports in serverless invocations) reuse the same pool instead of opening a
 * new connection per module evaluation.
 */
const cache: ConnectionCache = (globalThis.__solvepilotMongooseCache ??= {
  instance: null,
  promise: null,
  listenersBound: false,
});

// Security: wrap plain filter values in `$eq` so a crafted object can never be
// interpreted as a query operator (query-selector injection).
mongoose.set("sanitizeFilter", true);
// Fail fast instead of buffering: services always await connectToDatabase(),
// and a silent 10s buffer hides real connectivity problems.
mongoose.set("bufferCommands", false);

function connectionOptions(): ConnectOptions {
  const env = getServerEnv();
  const isProduction = env.NODE_ENV === "production";

  return {
    dbName: env.MONGODB_DB_NAME,
    appName: "solvepilot",
    maxPoolSize: 10,
    minPoolSize: isProduction ? 2 : 0,
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    maxIdleTimeMS: 60_000,
    // Development convenience; production indexes are synced explicitly with
    // `npm run db:verify` (or a deployment step) instead of on every boot.
    autoIndex: !isProduction,
  };
}

function bindConnectionListeners(): void {
  if (cache.listenersBound) return;
  cache.listenersBound = true;

  const connection = mongoose.connection;

  connection.on("connected", () => {
    log.info("MongoDB connected", { database: connection.name, host: connection.host });
  });
  connection.on("reconnected", () => log.warn("MongoDB connection re-established"));
  connection.on("disconnected", () => log.warn("MongoDB connection lost"));
  connection.on("error", (error: unknown) => log.error("MongoDB connection error", error));
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getServerEnv().MONGODB_URI);
}

/**
 * Resolve the shared Mongoose connection, opening it on first use.
 *
 * Throws an actionable error when MONGODB_URI is missing or the server is
 * unreachable; the API layer converts that into a generic 500 for the client
 * while the real reason is logged server-side.
 */
export async function connectToDatabase(): Promise<Mongoose> {
  if (cache.instance) return cache.instance;

  const uri = getServerEnv().MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not configured. Add a mongodb:// or mongodb+srv:// connection string to .env.local (see .env.example).",
    );
  }

  if (!cache.promise) {
    bindConnectionListeners();

    cache.promise = mongoose
      .connect(uri, connectionOptions())
      .then((instance) => {
        cache.instance = instance;
        return instance;
      })
      .catch((error: unknown) => {
        // Reset so the next call can retry instead of replaying the failure.
        cache.promise = null;
        log.error("MongoDB connection failed", error);
        throw error;
      });
  }

  return cache.promise;
}

/** Close the shared connection. Used by scripts, tests and shutdown hooks. */
export async function disconnectFromDatabase(): Promise<void> {
  if (!cache.instance && !cache.promise) return;

  await mongoose.disconnect();
  cache.instance = null;
  cache.promise = null;
  log.info("MongoDB connection closed");
}

const STATE_LABELS: readonly DatabaseState[] = [
  "disconnected",
  "connected",
  "connecting",
  "disconnecting",
];

export function getDatabaseStatus(): DatabaseStatus {
  const connection = mongoose.connection;
  const readyState = connection.readyState;

  return {
    configured: isDatabaseConfigured(),
    state: STATE_LABELS[readyState] ?? "uninitialized",
    databaseName: connection.name ?? null,
    host: connection.host ?? null,
  };
}

/** Lightweight connectivity probe for health checks and diagnostics. */
export async function pingDatabase(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  try {
    const instance = await connectToDatabase();
    const admin = instance.connection.db?.admin();
    if (!admin) return false;

    const result = await admin.ping();
    return result.ok === 1;
  } catch (error) {
    log.error("MongoDB ping failed", error);
    return false;
  }
}
