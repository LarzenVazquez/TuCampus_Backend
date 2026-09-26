import { Request } from "express";

const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:4200",
  "http://localhost:4000",
  "http://localhost:3000",
  "https://tu-campus-frontend.vercel.app",
];

const splitEnv = (value?: string): string[] =>
  (value || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
export const allowedOrigins: string[] = Array.from(
  new Set([
    ...DEFAULT_ORIGINS,
    ...splitEnv(process.env.ALLOWED_ORIGINS),
    ...splitEnv(process.env.FRONTEND_URL),
  ]),
);

export const isOriginAllowed = (origin?: string | null): boolean =>
  !origin || allowedOrigins.includes(origin.replace(/\/+$/, ""));

export const corsOriginCallback = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => {
  if (isOriginAllowed(origin)) callback(null, true);
  else callback(new Error("Origen no permitido por política CORS"));
};
export const resolveFrontendBase = (req?: Request): string => {
  const origin = (req?.headers?.origin as string | undefined)?.replace(
    /\/+$/,
    "",
  );
  if (origin && allowedOrigins.includes(origin)) return origin;
  const fromEnv = splitEnv(process.env.FRONTEND_URL)[0];
  return fromEnv || "https://tu-campus-frontend.vercel.app";
};
export const frontendPaths = {
  verifyEmail:
    process.env.FRONTEND_VERIFY_EMAIL_PATH || "/auth/verify-email.html",
  resetPassword:
    process.env.FRONTEND_RESET_PASSWORD_PATH || "/auth/reset-password.html",
  paymentSuccess:
    process.env.FRONTEND_PAYMENT_SUCCESS_PATH || "/store/confirmacion.html",
  paymentFailure:
    process.env.FRONTEND_PAYMENT_FAILURE_PATH || "/store/carrito.html",
};

export const safeRelativePath = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (
    !v.startsWith("/") ||
    v.startsWith("//") ||
    v.includes("\\") ||
    v.length > 200
  ) {
    return fallback;
  }
  return v;
};
