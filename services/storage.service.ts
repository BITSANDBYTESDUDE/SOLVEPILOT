import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { access, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getServerEnv } from "@/lib/config/env";
import { StorageError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const log = logger.child("storage");

export interface StorageProvider {
  upload(file: Buffer, key: string, mimeType: string): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getFile(key: string): Promise<Buffer>;
}

/** Strict key validation shared by provider adapters: no paths are user supplied. */
export function normalizeStorageKey(key: string): string {
  if (!key || key.length > 1024 || key.includes("\\") || key.startsWith("/")) {
    throw new ValidationError("Invalid storage key.");
  }
  const segments = key.split("/");
  if (
    segments.some(
      (segment) =>
        !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9._-]+$/.test(segment),
    )
  ) {
    throw new ValidationError("Invalid storage key.");
  }
  return segments.join("/");
}

/** Private local adapter for development when no object store is configured. */
export class LocalStorageProvider implements StorageProvider {
  readonly rootDirectory: string;

  constructor(rootDirectory = path.resolve(process.cwd(), ".storage", "private")) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  private resolveKey(key: string): string {
    const normalized = normalizeStorageKey(key);
    const resolved = path.resolve(this.rootDirectory, ...normalized.split("/"));
    const relative = path.relative(this.rootDirectory, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new ValidationError("Invalid storage key.");
    }
    return resolved;
  }

  async upload(file: Buffer, key: string): Promise<void> {
    const target = this.resolveKey(key);
    await mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    await chmod(this.rootDirectory, 0o700);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, file, { flag: "wx", mode: 0o600 });
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolveKey(key));
      return true;
    } catch (error) {
      if (isNodeFileMissing(error)) return false;
      throw error;
    }
  }

  async getFile(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKey(key));
    } catch (error) {
      if (isNodeFileMissing(error))
        throw new StorageError("The stored attachment is unavailable.", error);
      throw error;
    }
  }
}

class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: {
    endpoint?: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    forcePathStyle: boolean;
  }) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async upload(file: Buffer, key: string, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: normalizeStorageKey(key),
        Body: file,
        ContentType: mimeType,
        // No ACL is set; the bucket remains private.
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: normalizeStorageKey(key) }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: normalizeStorageKey(key) }),
      );
      return true;
    } catch (error) {
      const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        candidate.name === "NotFound" ||
        candidate.name === "NoSuchKey" ||
        candidate.$metadata?.httpStatusCode === 404
      )
        return false;
      throw error;
    }
  }

  async getFile(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: normalizeStorageKey(key) }),
    );
    if (!result.Body) throw new StorageError("The stored attachment is unavailable.");
    return Buffer.from(await result.Body.transformToByteArray());
  }
}

let provider: StorageProvider | null = null;

/** Test harness hook for using isolated local storage instead of a configured cloud bucket. */
export function setStorageProviderForTests(value: StorageProvider | null): void {
  provider = value;
}

/** Select S3-compatible storage when fully configured, local private storage in development. */
export function getStorageProvider(): StorageProvider {
  if (provider) return provider;
  const env = getServerEnv();
  const configuredValues = [env.STORAGE_ACCESS_KEY, env.STORAGE_SECRET_KEY, env.STORAGE_BUCKET];
  const anyConfigured = configuredValues.some(Boolean) || Boolean(env.STORAGE_ENDPOINT);
  const allRequiredConfigured = configuredValues.every(Boolean);

  if (anyConfigured && !allRequiredConfigured) {
    log.error("object storage configuration is incomplete");
    throw new StorageError();
  }
  if (allRequiredConfigured) {
    provider = new S3StorageProvider({
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      accessKeyId: env.STORAGE_ACCESS_KEY!,
      secretAccessKey: env.STORAGE_SECRET_KEY!,
      bucket: env.STORAGE_BUCKET!,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    });
    return provider;
  }
  if (env.NODE_ENV === "production") {
    log.error("private object storage is required in production but is not configured");
    throw new StorageError();
  }
  log.warn(
    "using private local attachment storage; configure S3-compatible storage for deployment",
  );
  provider = new LocalStorageProvider();
  return provider;
}

function isNodeFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
