import { db } from "@workspace/db";
import type { StoredRole } from "@workspace/rbac";
import { usersTable, type PublicUser } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./password";

export async function findUserByUsername(username: string) {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  return rows[0] ?? null;
}

export async function findUserById(id: number) {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export function toPublicUser(user: {
  id: number;
  username: string;
  role: StoredRole;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function createUser(input: {
  username: string;
  password: string;
  role: StoredRole;
}): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password);

  const [created] = await db
    .insert(usersTable)
    .values({
      username: input.username,
      passwordHash,
      role: input.role,
    })
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    });

  if (!created) {
    throw new Error("Failed to create user");
  }

  return toPublicUser(created);
}

export async function countUsers(): Promise<number> {
  const rows = await db.select({ id: usersTable.id }).from(usersTable);
  return rows.length;
}
