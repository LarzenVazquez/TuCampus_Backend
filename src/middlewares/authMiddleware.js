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

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.rol === "admin") {
    next();
  } else {
    res
      .status(403)
      .json({ error: "Permisos insuficientes: Se requiere rol de Admin" });
  }
};

module.exports = { verifyToken, isAdmin };
