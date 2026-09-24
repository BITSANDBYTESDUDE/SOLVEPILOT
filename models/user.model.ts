import { Schema, type Model } from "mongoose";

import { baseSchemaOptions, registeredModel } from "@/models/schema-options";
import { GLOBAL_ROLES, THEMES, type GlobalRole, type Theme } from "@/types/domain";

export interface UserPreferences {
  theme: Theme;
  emailNotifications: boolean;
}

export interface UserDocument {
  name: string;
  email: string;
  /** bcrypt/argon2 hash. `select: false` keeps it out of normal queries. */
  passwordHash?: string;
  avatarUrl?: string | null;
  role: GlobalRole;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "system",
  emailNotifications: true,
};

const preferencesSchema = new Schema<UserPreferences>(
  {
    theme: { type: String, enum: [...THEMES], default: "system", required: true },
    emailNotifications: { type: Boolean, default: true, required: true },
  },
  { _id: false },
);

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address."],
    },
    passwordHash: { type: String, select: false },
    avatarUrl: { type: String, trim: true, maxlength: 2048, default: null },
    role: { type: String, enum: [...GLOBAL_ROLES], default: "user", required: true },
    preferences: { type: preferencesSchema, default: () => ({ ...DEFAULT_USER_PREFERENCES }) },
  },
  baseSchemaOptions,
);

// Uniqueness is declared only here (declaring `unique: true` on the path as well
// would create a duplicate index).
userSchema.index({ email: 1 }, { unique: true, name: "email_unique" });
userSchema.index({ createdAt: -1 }, { name: "created_at_desc" });

export const User: Model<UserDocument> = registeredModel<UserDocument>("User", userSchema, "users");
