const jwt = require("jsonwebtoken");

/**
 * Verifica si el token JWT es válido
 */
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

/**
 * Valida Admin General (Sigla: 'A')
 */
const isAdmin = (req, res, next) => {
  if (req.user && req.user.rol.trim() === "A") {
    next();
  } else {
    res.status(403).json({
      error: "Permisos insuficientes: Se requiere rol Admin Maestro (A)",
    });
  }
};

/**
 * Valida Admin de Cafetería (Sigla: 'A_C') o Admin General (Sigla: 'A')
 */
const isAdminC = (req, res, next) => {
  const rol = req.user?.rol?.trim();
  if (req.user && (rol === "A" || rol === "A_C")) {
    next();
  } else {
    res.status(403).json({
      message: "Acceso denegado: Se requiere rol administrativo o de cocina.",
    });
  }
};

/**
 * Valida si es Vendedor Verificado (Sigla: 'A_V') o Admin Maestro (Sigla: 'A')
 */
const isSeller = (req, res, next) => {
  const rol = req.user?.rol?.trim();
  if (req.user && (rol === "A_V" || rol === "A")) {
    next();
  } else {
    res.status(403).json({
      error:
        "Acceso denegado: Debes ser un vendedor verificado o administrador",
    });
  }
};

// EXPORTACIÓN COMPLETA - Esto evita el error "isSeller is not defined" en iaRoutes
module.exports = {
  verifyToken,
  isAdmin,
  isAdminC,
  isSeller,
};
