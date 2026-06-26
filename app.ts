/// <reference path="./src/types/index.ts" />
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

// Importación de rutas
import authRoutes from "./src/api/routes/authRoutes";
import userRoutes from "./src/api/routes/userRoutes";
import adminRoutes from "./src/api/routes/adminRoutes";
import notificationRoutes from "./src/api/routes/notificationRoutes";
import cafeRoutes from "./src/api/routes/cafeRoutes";
import marketRoutes from "./src/api/routes/marketRoutes";
import orderRoutes from "./src/api/routes/orderRoutes";
import chatRoutes from "./src/api/routes/chatRoutes";
import iaRoutes from "./src/api/routes/iaRoutes";

dotenv.config();

const app: Application = express();

// --- RATE LIMITERS ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Demasiadas peticiones, intente más tarde." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos de acceso, intente en 15 minutos." },
});

app.use(helmet());

// CORRECCIÓN: Convertido a Set para cumplir con las reglas de SonarQube
const allowedOrigins = new Set(
  [
    "http://localhost:5173",
    "https://tu-campus-frontend.vercel.app",
    process.env.FRONTEND_URL || "",
  ].filter(Boolean),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // CORRECCIÓN: Se utiliza .has() en lugar de .includes() para evaluar el Set
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origen no permitido por política CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(limiter);

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// --- DEFINICIÓN DE ENDPOINTS ---
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/cafe", cafeRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ia", iaRoutes);

app.get("/api/ping", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "Servidor TuCampus activo (TS)",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error detectado:", err.stack);
  res.status(500).json({ error: "Ocurrió un error interno en el servidor" });
});

export default app;
