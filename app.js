// src/app.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./src/api/auth-service/routes/authRoutes");

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (Necesario para el Punto C de la evaluación)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// RUTAS DE SEGURIDAD (Aquí están tus 100 puntos)
app.use("/api/auth", authRoutes);

app.get("/api/ping", (req, res) => {
  res
    .status(200)
    .json({ status: "ok", message: "Servidor de Seguridad Activo" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada o deshabilitada" });
});

module.exports = app;
