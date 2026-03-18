const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

// Importación de rutas
const authRoutes = require("./src/api/auth-service/routes/authRoutes");
const cafeRoutes = require("./src/api/campus-service/routes/cafeRoutes");

const app = express();

/* --- Configuración de Middlewares --- */
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

/* --- Definición de Rutas --- */

// Rutas de seguridad / Autenticación
app.use("/api/auth", authRoutes);

// Rutas de Campus / Cafetería
app.use("/api", cafeRoutes);

/* --- Comprobación del estado del servidor --- */
app.get("/api/ping", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Servidor activo",
    uptime: process.uptime(),
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada o deshabilitada" });
});

module.exports = app;
