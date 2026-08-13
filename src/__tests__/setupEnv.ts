process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_local";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/test";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "";
process.env.NODE_ENV = "test";
