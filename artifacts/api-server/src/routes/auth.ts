import { Router, type IRouter } from "express";
import { authenticateRequired } from "../middleware/auth";
import { signAccessToken } from "../lib/auth/jwt";
import { verifyPassword } from "../lib/auth/password";
import {
  loginBodySchema,
  loginResponseSchema,
  meResponseSchema,
  registerBodySchema,
} from "../lib/auth/schemas";
import {
  countUsers,
  createUser,
  findUserById,
  findUserByUsername,
  toPublicUser,
} from "../lib/auth/users";
import { getEffectiveRole, requirePermission } from "../middleware/auth";

const router: IRouter = Router();

function serializeUser(user: ReturnType<typeof toPublicUser>) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

// POST /api/auth/login
router.post("/login", async (req, res): Promise<void> => {
  const parsed = loginBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().formErrors.join("; ") || "Invalid request" });
    return;
  }

  const { username, password } = parsed.data;
  const user = await findUserByUsername(username);

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const publicUser = toPublicUser(user);
  const accessToken = signAccessToken({
    sub: publicUser.id,
    username: publicUser.username,
    role: publicUser.role,
  });

  res.json(
    loginResponseSchema.parse({
      accessToken,
      user: serializeUser(publicUser),
    }),
  );
});

// POST /api/auth/register
router.post("/register", async (req, res): Promise<void> => {
  const parsed = registerBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().formErrors.join("; ") || "Invalid request" });
    return;
  }

  const { username, password, role: requestedRole } = parsed.data;
  const existing = await findUserByUsername(username);

  if (existing) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const totalUsers = await countUsers();
  const effectiveRole = getEffectiveRole(req);

  let role = requestedRole ?? "user";

  if (totalUsers === 0) {
    role = "admin";
  } else if (role !== "user") {
    if (effectiveRole !== "admin") {
      res.status(403).json({ error: "Only administrators can assign elevated roles" });
      return;
    }
  }

  try {
    const created = await createUser({ username, password, role });
    const accessToken = signAccessToken({
      sub: created.id,
      username: created.username,
      role: created.role,
    });

    res.status(201).json(
      loginResponseSchema.parse({
        accessToken,
        user: serializeUser(created),
      }),
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Registration failed";
    req.log.error({ err: msg }, "User registration failed");
    res.status(500).json({ error: "Could not register user" });
  }
});

// GET /api/auth/me
router.get("/me", authenticateRequired, async (req, res): Promise<void> => {
  const auth = req.auth;

  if (!auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const user = await findUserById(auth.userId);

  if (!user) {
    res.status(401).json({ error: "User no longer exists" });
    return;
  }

  res.json(
    meResponseSchema.parse({
      user: serializeUser(toPublicUser(user)),
    }),
  );
});

// GET /api/auth/users — admin user listing
router.get(
  "/users",
  authenticateRequired,
  requirePermission("manage:users"),
  async (_req, res): Promise<void> => {
    const { db } = await import("@workspace/db");
    const { usersTable } = await import("@workspace/db/schema");

    const rows = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable);

    res.json({
      users: rows.map((row: (typeof rows)[number]) => ({
        id: row.id,
        username: row.username,
        role: row.role,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  },
);

export default router;
