function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} environment variable is required but was not provided.`);
  }
  return value.trim();
}

export function getJwtSecret(): string {
  return requireEnv("JWT_SECRET");
}

export function getJwtExpiresIn(): string {
  return process.env["JWT_EXPIRES_IN"]?.trim() || "24h";
}
