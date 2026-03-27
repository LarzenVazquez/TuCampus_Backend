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

// Valida Admin General (Sigla: 'A')
const isAdmin = (req, res, next) => {
  if (req.user && req.user.rol === "A") {
    next();
  } else {
    res
      .status(403)
      .json({ error: "Permisos insuficientes: Se requiere rol Admin (A)" });
  }
};

// Valida Admin de Cafetería (Sigla: 'A_C')
// Nota: El Admin General ('A') también suele tener acceso aquí.
const isAdminC = (req, res, next) => {
  if (req.user && (req.user.rol === "A_C" || req.user.rol === "A")) {
    next();
  } else {
    res.status(403).json({
      error: "Acceso denegado: Solo para Administración de Cafetería",
    });
  }
};

// Valida si es Vendedor Verificado (Sigla: 'A_V') o Admin
const isSeller = (req, res, next) => {
  if (req.user && (req.user.rol === "A_V" || req.user.rol === "A")) {
    next();
  } else {
    res
      .status(403)
      .json({ error: "Debes ser un vendedor verificado para publicar" });
  }
};

module.exports = { verifyToken, isAdmin, isAdminC, isSeller };
