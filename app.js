/* src/app.js */
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

const authroutes = require("./src/api/auth-service/routes/authroutes");

const app = express();

/* configuracion de middlewares */
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

/* rutas de seguridad */
app.use("/api/auth", authroutes);

/* comprobacion del estado del servidor */
app.get("/api/ping", (req, res) => {
  res
    .status(200)
    .json({ status: "ok", message: "servidor de seguridad activo" });
});

/* manejo de rutas no encontradas */
app.use((req, res) => {
  res.status(404).json({ error: "ruta no encontrada o deshabilitada" });
});

module.exports = app;
