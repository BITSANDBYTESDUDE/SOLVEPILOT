import mongoose, { Schema, type Model, type SchemaOptions } from "mongoose";

/**
 * Shared schema conventions.
 *
 * Every collection follows the same rules:
 *  - `timestamps: true`   → createdAt/updatedAt on every document,
 *  - `versionKey: false`  → no `__v` noise in API payloads,
 *  - `toJSON` transform   → `_id` becomes `id`, secrets are stripped,
 *  - explicit collections → snake_case names matching the data model spec.
 */

/** Keys that must never leave the server through JSON serialization. */
const NEVER_SERIALIZED = new Set(["__v", "passwordHash"]);

export function transformDocument(
  _doc: unknown,
  ret: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of NEVER_SERIALIZED) {
    delete ret[key];
  }

  const id = ret._id;
  if (id !== undefined && id !== null) {
    ret.id = String(id);
  }
  delete ret._id;

  return ret;
}

export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  versionKey: false,
  minimize: false,
  toJSON: { virtuals: true, versionKey: false, transform: transformDocument },
  toObject: { virtuals: true, versionKey: false, transform: transformDocument },
};

/**
 * Register (or reuse) a model.
 *
 * Next.js re-evaluates modules on hot reload, and Mongoose throws
 * `OverwriteModelError` when a model name is compiled twice — reusing the
 * cached entry keeps development and serverless runtimes stable.
 */
export function registeredModel<TDocument>(
  name: string,
  schema: Schema<TDocument>,
  collection: string,
): Model<TDocument> {
  const existing = mongoose.models[name] as Model<TDocument> | undefined;
  return existing ?? mongoose.model<TDocument>(name, schema, collection);
}

/** Reusable ObjectId reference definition (keeps models uniform and terse). */
export const objectIdRef = (ref: string, options: { required?: boolean } = {}) => ({
  type: Schema.Types.ObjectId,
  ref,
  required: options.required ?? true,
});
