const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const authRoutes = require("./src/api/auth-service/routes/authRoutes");
const cafeRoutes = require("./src/api/campus-service/routes/cafeRoutes");

const app = express();

/* middlewares */
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Definición de prefijos para rutas (Estructura SOA)
app.use("/api/auth", authRoutes);
app.use("/api/campus", cafeRoutes);

/* verificacion de servidor prendido */
app.get("/api/ping", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

/* rutas no encontradas */
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

module.exports = app;
