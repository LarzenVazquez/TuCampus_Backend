const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// --- IMPORTACIÓN DE RUTAS ---

// SQL Service (MySQL)
const authRoutes = require("./src/api/sql-service/routes/authRoutes");
const adminRoutes = require("./src/api/sql-service/routes/adminRoutes");
const userRoutes = require("./src/api/sql-service/routes/userRoutes");


// NoSQL Service (MongoDB)
const cafeRoutes = require("./src/api/nsql-service/routes/cafeRoutes");
const marketRoutes = require("./src/api/nsql-service/routes/marketRoutes");
const orderRoutes = require("./src/api/nsql-service/routes/orderRoutes");
const chatRoutes = require("./src/api/nsql-service/routes/chatRoutes");
const iaRoutes = require("./src/api/nsql-service/routes/iaRoutes");

const app = express();

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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- DEFINICIÓN DE ENDPOINTS ---

// Rutas de Autenticación y Usuario (SQL)
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", require("./src/api/sql-service/routes/notificationRoutes"));

// Rutas de Servicios del Campus (NoSQL)
app.use("/api/cafe", cafeRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ia", iaRoutes);

app.get("/api/ping", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Servidor TuCampus activo",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

app.use("/api/", limiter);

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada o deshabilitada" });
});

app.use((err, req, res, next) => {
  console.error("Error detectado en TuCampus:", err.stack);
  res.status(500).json({ error: "Ocurrió un error interno en el servidor" });
});

module.exports = app;
