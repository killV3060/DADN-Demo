// seed-users.ts - Creates example users for RBAC testing
// Run: pnpm --filter @workspace/scripts run seed-users
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";

const SALT_ROUNDS = 10;

const users = [
  { username: "admin",     password: "admin123",   role: "admin"     },
  { username: "developer", password: "dev123",     role: "developer" },
];

async function seed() {
  console.log("Seeding users...");

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);

    await db
      .insert(usersTable)
      .values({ username: u.username, passwordHash, role: u.role })
      .onConflictDoNothing(); // skip if already exists

    console.log(`  ✓ ${u.username} (role: ${u.role})`);
  }

  console.log("\nDone! Example credentials:");
  console.log("  admin     / admin123   → role: admin");
  console.log("  developer / dev123     → role: developer");
  console.log("  (no login)             → role: guest (read-only)");

  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
