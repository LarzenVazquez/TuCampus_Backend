/// <reference path="./src/types/index.ts" />
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

// Importación de rutas (Ajustadas a los nuevos archivos .ts)
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

// --- MIDDLEWARES GLOBALES ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Demasiadas peticiones, intente más tarde." },
});

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

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

app.get("/api/ping", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "Servidor TuCampus activo (TS)",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

app.use("/api/", limiter);

// Manejo de errores 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Manejo de errores 500
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error detectado:", err.stack);
  res.status(500).json({ error: "Ocurrió un error interno en el servidor" });
});

export default app;
