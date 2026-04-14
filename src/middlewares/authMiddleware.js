const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ error: "Acceso denegado: No se proporcionó un token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contiene { id, rol, email, nombre }
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
};

const isAdmin = (req, res, next) => {
  const rol = req.user?.rol?.trim();
  if (req.user && rol === "A") {
    next();
  } else {
    res.status(403).json({
      error: "Permisos insuficientes: Se requiere rol Admin Maestro (A)",
    });
  }
};

const isAdminC = (req, res, next) => {
  const rol = req.user?.rol?.trim();
  if (req.user && rol === "A_C") {
    next();
  } else {
    res.status(403).json({
      error: "Acceso denegado: Se requiere rol de Admin de Cocina (A_C)",
    });
  }
};

const isSeller = (req, res, next) => {
  const rol = req.user?.rol?.trim();
  if (req.user && rol === "A_V") {
    next();
  } else {
    res.status(403).json({
      error: "Acceso denegado: Se requiere rol de Vendedor Verificado (A_V)",
    });
  }
};

const isAlumno = (req, res, next) => {
  const rol = req.user?.rol?.trim();
  if (req.user && rol === "AL") {
    next();
  } else {
    res.status(403).json({
      error: "Acceso denegado: Se requiere rol de Alumno (AL)",
    });
  }
};

// EXPORTACIÓN COMPLETA
module.exports = {
  verifyToken,
  isAdmin,
  isAdminC,
  isSeller,
  isAlumno,
};
