const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const authRoutes = require("./src/api/sql-service/routes/authRoutes");
const adminRoutes = require("./src/api/sql-service/routes/adminRoutes");
const cafeRoutes = require("./src/api/nsql-service/routes/cafeRoutes");
const marketRoutes = require("./src/api/nsql-service/routes/marketRoutes");
const orderRoutes = require("./src/api/nsql-service/routes/orderRoutes");

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Demasiadas peticiones, intente más tarde." },
});

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/", limiter);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cafe", cafeRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/orders", orderRoutes);

app.get("/api/ping", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Servidor TuCampus activo",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada o deshabilitada" });
});

app.use((err, req, res, next) => {
  console.error("Error detectado:", err.stack);
  res.status(500).json({ error: "Ocurrió un error interno en el servidor" });
});

module.exports = app;
