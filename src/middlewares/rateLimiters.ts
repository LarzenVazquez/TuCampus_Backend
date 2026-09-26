import rateLimit from "express-rate-limit";
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones, intente más tarde." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de acceso, intente en 15 minutos." },
});

export const contactoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.CONTACTO_RATE_LIMIT_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Has enviado demasiados mensajes. Intenta más tarde." },
});
