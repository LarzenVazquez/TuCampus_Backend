import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import dotenv from "dotenv";

import authRoutes from "./src/api/routes/authRoutes";
import userRoutes from "./src/api/routes/userRoutes";
import adminRoutes from "./src/api/routes/adminRoutes";
import notificationRoutes from "./src/api/routes/notificationRoutes";
import cafeRoutes from "./src/api/routes/cafeRoutes";
import marketRoutes from "./src/api/routes/marketRoutes";
import orderRoutes from "./src/api/routes/orderRoutes";
import chatRoutes from "./src/api/routes/chatRoutes";
import iaRoutes from "./src/api/routes/iaRoutes";
import contactoRoutes from "./src/api/routes/contactoRoutes";
import { corsOriginCallback } from "./src/lib/appConfig";
import { generalLimiter } from "./src/middlewares/rateLimiters";

dotenv.config();

const app: Application = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin: corsOriginCallback,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(generalLimiter);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- DEFINICIÓN DE ENDPOINTS ---
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/cafe", cafeRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ia", iaRoutes);
app.use("/api/contacto", contactoRoutes);

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
  if (err?.message?.includes("CORS")) {
    res.status(403).json({ error: "Origen no permitido" });
    return;
  }

  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON inválido en la petición" });
    return;
  }
  console.error("Error detectado:", err.stack);
  res.status(500).json({ error: "Ocurrió un error interno en el servidor" });
});

export default app;
