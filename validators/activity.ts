import { Types } from "mongoose";
import { z } from "zod";

import { ACTIVITY_ACTIONS, type ActivityAction } from "@/types/domain";

export const activityActionSchema = z.enum(ACTIVITY_ACTIONS, {
  message: "Invalid activity action.",
});

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be at least 1.").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1.")
    .max(100, "Limit cannot exceed 100.")
    .default(20),
  action: activityActionSchema.optional(),
  projectId: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), { message: "Invalid project ID." })
    .optional(),
});

export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;

export const createActivitySchema = z.object({
  workspaceId: z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: "Invalid workspace ID.",
  }),
  actorId: z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: "Invalid actor ID.",
  }),
  action: activityActionSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
  issueId: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), { message: "Invalid issue ID." })
    .optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export type { ActivityAction };
