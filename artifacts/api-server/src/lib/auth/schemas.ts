import { z } from "zod";
import { STORED_ROLES } from "@workspace/rbac";

export const loginBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(64, "Username must be at most 64 characters"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be at most 128 characters"),
});

export const registerBodySchema = loginBodySchema.extend({
  role: z.enum(STORED_ROLES).optional(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  role: z.enum(STORED_ROLES),
  createdAt: z.string(),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});

export const meResponseSchema = z.object({
  user: authUserSchema,
});
