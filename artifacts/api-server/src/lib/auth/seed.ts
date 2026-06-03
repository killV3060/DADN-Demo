import { logger } from "../logger";
import { countUsers, createUser, findUserByUsername } from "./users";

const SEED_ACCOUNTS = [
  { username: "admin", password: "admin123", role: "admin" as const },
  { username: "developer", password: "dev123", role: "developer" as const },
  { username: "user", password: "user123", role: "user" as const },
];

export async function seedDefaultUsers(): Promise<void> {
  try {
    const total = await countUsers();

    if (total > 0) {
      return;
    }

    for (const account of SEED_ACCOUNTS) {
      const existing = await findUserByUsername(account.username);
      if (existing) {
        continue;
      }

      await createUser(account);
      logger.info({ username: account.username, role: account.role }, "Seeded default user");
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logger.warn({ err: msg }, "Could not seed default users");
  }
}
