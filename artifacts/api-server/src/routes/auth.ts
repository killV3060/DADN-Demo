// auth.ts - Authentication routes
// POST /auth/login → returns JWT token
// GET  /auth/me    → returns current user info
import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";
import { requireAuth, JWT_SECRET, JWT_EXPIRES_IN } from "../middlewares/auth";

const router: IRouter = Router();

// POST /api/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  // Find user in DB
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // Sign JWT
  const payload = { id: user.id, username: user.username, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  req.log.info({ username: user.username, role: user.role }, "User logged in");

  res.json(
    LoginResponse.parse({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    }),
  );
});

// GET /api/auth/me — returns current user (requires valid token)
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  res.json(
    GetMeResponse.parse({
      id: req.user!.id,
      username: req.user!.username,
      role: req.user!.role,
    }),
  );
});

export default router;
